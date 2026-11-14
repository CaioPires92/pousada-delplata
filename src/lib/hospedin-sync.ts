import { addDays, format } from 'date-fns';

import prisma from '@/lib/prisma';
import { hospedinClient } from '@/lib/hospedin';
import { clampInventory, getAutomaticInventory, getEffectiveInventory } from '@/lib/inventory-policy';

type SyncHospedinOptions = {
  beginDate: string;
  endDate: string;
  roomTypeId?: string;
};

/** Dias novos entram em lotes (1 ida ao banco por lote); alterações de dias existentes, algumas por vez. */
const CREATE_CHUNK_SIZE = 100;
const WRITE_CONCURRENCY = 10;

async function runInChunks<T>(items: T[], size: number, worker: (item: T) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker));
  }
}

/**
 * Traz do Hospedin as vagas livres por dia e grava em InventoryAdjustment.
 *
 * - Só o ESTOQUE é sincronizado. Os preços do site são geridos no próprio site e nunca são
 *   sobrescritos pelo Hospedin (antes, um valor > 0 vindo de lá criava tarifas mais novas e
 *   passava por cima das tarifas importadas do Booking).
 * - Dias que não mudaram não são regravados (só carimbam `hospedinSyncedAt`, em uma única
 *   consulta) e dias novos entram em lote (`createMany`), então rodar com frequência é barato e
 *   cabe nos limites da Vercel (o `upsert` do Prisma no Turso leva várias idas ao banco por dia).
 * - Ajustes manuais continuam preservados e são devolvidos em `manualOverrides`.
 */
export async function syncHospedinAvailability(options: SyncHospedinOptions) {
  const roomTypes = await prisma.roomType.findMany({
    where: {
      externalId: { not: null },
      NOT: { externalId: '' },
      ...(options.roomTypeId ? { id: options.roomTypeId } : {}),
    },
  });

  if (roomTypes.length === 0) {
    throw new Error(
      options.roomTypeId
        ? 'Acomodação selecionada não possui ID do Hospedin configurado.'
        : 'Nenhuma acomodação possui ID do Hospedin configurado.'
    );
  }

  const results = await Promise.all(roomTypes.map(async (room) => {
    try {
      const days = await hospedinClient.getAvailability(
        room.externalId!,
        options.beginDate,
        options.endDate
      );

      // Resposta vazia ou fora do formato NÃO é sucesso: sem isso o estoque ficaria velho sem aviso.
      if (!Array.isArray(days) || days.length === 0) {
        throw new Error(
          `O Hospedin não devolveu nenhum dia de disponibilidade para ${room.name} (${options.beginDate} a ${options.endDate}).`
        );
      }

      const dateKeys = days.map((day) => day.date).sort();
      const existingAdjustments = await prisma.inventoryAdjustment.findMany({
        where: {
          roomTypeId: room.id,
          dateKey: { gte: dateKeys[0], lte: dateKeys[dateKeys.length - 1] },
        },
      });
      const existingByDate = new Map(existingAdjustments.map((row) => [row.dateKey, row]));
      const manualOverrides: Array<{
        date: string;
        hospedinUnits: number;
        automaticUnits: number;
        manualUnits: number;
      }> = [];
      const syncedAt = new Date();
      const unchangedDateKeys: string[] = [];
      type SyncRow = {
        dateKey: string;
        date: Date;
        availableUnits: number;
        occupiedUnits: number;
        hospedinUnits: number;
        manualOverrideUnits: number | null;
      };
      const newRows: SyncRow[] = [];
      const changedExistingRows: SyncRow[] = [];

      for (const day of days) {
        const dateKey = day.date;
        const existing = existingByDate.get(dateKey);
        const hospedinUnits = clampInventory(day.availability, room.totalUnits);
        const manualOverrideUnits = existing?.manualOverrideUnits ?? null;
        const automaticUnits = getAutomaticInventory(hospedinUnits, room.totalUnits);
        const availableUnits = getEffectiveInventory({
          hospedinUnits,
          manualOverrideUnits,
          capacity: room.totalUnits,
        });
        const occupiedUnits = Math.max(0, room.totalUnits - hospedinUnits);

        if (manualOverrideUnits !== null && clampInventory(manualOverrideUnits, room.totalUnits) !== automaticUnits) {
          manualOverrides.push({
            date: dateKey,
            hospedinUnits,
            automaticUnits,
            manualUnits: clampInventory(manualOverrideUnits, room.totalUnits),
          });
        }

        const unchanged =
          existing !== undefined &&
          existing.hospedinUnits === hospedinUnits &&
          (existing.manualOverrideUnits ?? null) === manualOverrideUnits &&
          existing.totalUnits === availableUnits &&
          existing.occupiedUnits === occupiedUnits;

        if (unchanged) {
          unchangedDateKeys.push(dateKey);
          continue;
        }
        const row: SyncRow = {
          dateKey,
          date: new Date(`${dateKey}T00:00:00Z`),
          availableUnits,
          occupiedUnits,
          hospedinUnits,
          manualOverrideUnits,
        };
        (existing === undefined ? newRows : changedExistingRows).push(row);
      }

      const upsertRow = (row: SyncRow) =>
        prisma.inventoryAdjustment.upsert({
          where: { roomTypeId_dateKey: { roomTypeId: room.id, dateKey: row.dateKey } },
          update: {
            totalUnits: row.availableUnits,
            occupiedUnits: row.occupiedUnits,
            hospedinUnits: row.hospedinUnits,
            manualOverrideUnits: row.manualOverrideUnits,
            hospedinSyncedAt: syncedAt,
            date: row.date,
          },
          create: {
            roomTypeId: room.id,
            dateKey: row.dateKey,
            date: row.date,
            totalUnits: row.availableUnits,
            occupiedUnits: row.occupiedUnits,
            hospedinUnits: row.hospedinUnits,
            manualOverrideUnits: row.manualOverrideUnits,
            hospedinSyncedAt: syncedAt,
          },
        });

      for (let index = 0; index < newRows.length; index += CREATE_CHUNK_SIZE) {
        const chunk = newRows.slice(index, index + CREATE_CHUNK_SIZE);
        try {
          await prisma.inventoryAdjustment.createMany({
            data: chunk.map((row) => ({
              roomTypeId: room.id,
              dateKey: row.dateKey,
              date: row.date,
              totalUnits: row.availableUnits,
              occupiedUnits: row.occupiedUnits,
              hospedinUnits: row.hospedinUnits,
              manualOverrideUnits: row.manualOverrideUnits,
              hospedinSyncedAt: syncedAt,
            })),
          });
        } catch (error) {
          // Outra sincronização gravou esses dias ao mesmo tempo (unicidade): regrava um a um.
          console.warn(
            `[hospedin-sync] createMany falhou para ${room.name}; regravando um a um:`,
            error instanceof Error ? error.message : error
          );
          await runInChunks(chunk, WRITE_CONCURRENCY, upsertRow);
        }
      }

      await runInChunks(changedExistingRows, WRITE_CONCURRENCY, upsertRow);

      if (unchangedDateKeys.length > 0) {
        await prisma.inventoryAdjustment.updateMany({
          where: { roomTypeId: room.id, dateKey: { in: unchangedDateKeys } },
          data: { hospedinSyncedAt: syncedAt },
        });
      }

      return {
        roomName: room.name,
        daysSynced: days.length,
        daysChanged: newRows.length + changedExistingRows.length,
        manualOverrides,
      };
    } catch (error) {
      return {
        roomName: room.name,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }));

  return {
    beginDate: options.beginDate,
    endDate: options.endDate,
    results,
  };
}

export function getDefaultHospedinPeriod() {
  const today = new Date();
  return {
    beginDate: format(today, 'yyyy-MM-dd'),
    endDate: format(addDays(today, 60), 'yyyy-MM-dd'),
  };
}
