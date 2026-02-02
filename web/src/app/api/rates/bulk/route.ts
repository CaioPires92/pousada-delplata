import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';
import { assertDayKey, eachDayKeyInclusive, isNextDay } from '@/lib/day-key';

export async function POST(request: Request) {
    let ctxStartDate: string | undefined;
    let ctxEndDate: string | undefined;
    let ctxTargetCount: number | undefined;
    try {
        opsLog('info', 'BULK_ROUTE_HIT_v3', { path: '/api/rates/bulk' });
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const text = await request.text();
        if (!text) return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });

        const body = JSON.parse(text);
        const { roomTypeId, roomTypes, date, startDate, endDate, updates } = body;

        const effectiveStartDate = (date || startDate) as string | undefined;
        const effectiveEndDate = (date || endDate) as string | undefined;
        ctxStartDate = effectiveStartDate;
        ctxEndDate = effectiveEndDate;

        if ((!roomTypeId && !roomTypes) || !effectiveStartDate || !effectiveEndDate || !updates) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Função para garantir que temos apenas a string YYYY-MM-DD para lógica interna
        function coerceToYmd(input: unknown, label: string): string {
            if (typeof input !== 'string' || !input.trim()) {
                throw new Error(`[THROW_ORIGIN=BULK_COERCE] ${label} is required and must be string`);
            }
            const s = input.trim().replace(/[\u200B-\u200D\uFEFF\r\n\t]/g, '');
            const ymd = s.includes('T') || s.includes(' ') ? s.slice(0, 10) : s;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
                throw new Error(`[THROW_ORIGIN=BULK_YMD] Invalid ${label}. Expected YYYY-MM-DD.`);
            }
            return ymd;
        }

        const startStr = coerceToYmd(effectiveStartDate, 'startDate');
        const endStr = coerceToYmd(effectiveEndDate, 'endDate');

        // Objetos Date para o Prisma (fixados ao meio-dia para evitar erros de Timezone)
        const startObj = new Date(`${startStr}T00:00:00Z`);
        const endObj = new Date(`${endStr}T00:00:00Z`);

        // Identificação dos quartos alvo
        let targetRoomIds: string[] = [];
        const targetInput = roomTypes || roomTypeId;

        if (targetInput === 'all' || (Array.isArray(targetInput) && targetInput.includes('all'))) {
            const allRooms = await prisma.roomType.findMany({ select: { id: true } });
            targetRoomIds = allRooms.map(r => r.id);
        } else if (Array.isArray(targetInput)) {
            targetRoomIds = targetInput;
        } else {
            targetRoomIds = [targetInput];
        }

        const roomTypeRows = await prisma.roomType.findMany({
            where: { id: { in: targetRoomIds } },
            select: { id: true, basePrice: true }
        });
        const basePriceByRoomId = new Map(roomTypeRows.map(r => [r.id, Number(r.basePrice) || 0]));

        const dayKeysInRange = eachDayKeyInclusive(startStr, endStr);
        const ops: any[] = [];

        for (const currentRoomId of targetRoomIds) {
            const basePrice = basePriceByRoomId.get(currentRoomId) || 0;

            // Busca sobreposições usando tipos DateTime corretos
            const overlaps = await prisma.rate.findMany({
                where: {
                    roomTypeId: currentRoomId,
                    startDate: { lte: endObj },
                    endDate: { gte: startObj }
                }
            });

            const dayMap = new Map<string, any>();

            // Mapeia dados existentes
            for (const r of overlaps) {
                const sDay = r.startDate.toISOString().split('T')[0];
                const eDay = r.endDate.toISOString().split('T')[0];
                for (const dateKey of eachDayKeyInclusive(sDay, eDay)) {
                    dayMap.set(dateKey, {
                        price: Number(r.price),
                        stopSell: r.stopSell,
                        cta: r.cta,
                        ctd: r.ctd,
                        minLos: r.minLos
                    });
                }
            }

            // Aplica os novos updates
            const hasPriceUpdate = updates.price !== undefined && updates.price !== '';
            const priceValue = hasPriceUpdate ? Number(updates.price) : undefined;
            const hasMinLosUpdate = updates.minLos !== undefined && updates.minLos !== '';
            const minLosValue = hasMinLosUpdate ? Number.parseInt(updates.minLos) : undefined;

            for (const dateKey of dayKeysInRange) {
                const existing = dayMap.get(dateKey) || {
                    price: basePrice,
                    stopSell: false,
                    cta: false,
                    ctd: false,
                    minLos: 1
                };

                dayMap.set(dateKey, {
                    price: hasPriceUpdate ? priceValue : existing.price,
                    stopSell: (updates.stopSell !== undefined && updates.stopSell !== '') ? Boolean(updates.stopSell) : existing.stopSell,
                    cta: (updates.cta !== undefined && updates.cta !== '') ? Boolean(updates.cta) : existing.cta,
                    ctd: (updates.ctd !== undefined && updates.ctd !== '') ? Boolean(updates.ctd) : existing.ctd,
                    minLos: hasMinLosUpdate ? minLosValue : existing.minLos,
                });
            }

            // Agrupa em intervalos consecutivos para otimizar o banco
            const sortedDates = Array.from(dayMap.keys()).sort();
            const intervals: any[] = [];
            let currentInterval: any = null;

            for (const dateKey of sortedDates) {
                const data = dayMap.get(dateKey);
                if (!currentInterval) {
                    currentInterval = { start: dateKey, end: dateKey, data };
                    continue;
                }
                const isConsecutive = isNextDay(currentInterval.end, dateKey);
                const isSameData = JSON.stringify(data) === JSON.stringify(currentInterval.data);

                if (isConsecutive && isSameData) {
                    currentInterval.end = dateKey;
                } else {
                    intervals.push(currentInterval);
                    currentInterval = { start: dateKey, end: dateKey, data };
                }
            }
            if (currentInterval) intervals.push(currentInterval);

            // Adiciona operações de deleção e criação na transação
            if (overlaps.length > 0) {
                ops.push(prisma.rate.deleteMany({ where: { id: { in: overlaps.map(o => o.id) } } }));
            }

            if (intervals.length > 0) {
                const rateRows = intervals.map(interval => ({
                    roomTypeId: currentRoomId,
                    startDate: new Date(`${interval.start}T00:00:00Z`),
                    endDate: new Date(`${interval.end}T00:00:00Z`),
                    price: interval.data.price,
                    stopSell: interval.data.stopSell,
                    cta: interval.data.cta,
                    ctd: interval.data.ctd,
                    minLos: interval.data.minLos
                }));
                ops.push(prisma.rate.createMany({ data: rateRows }));
            }

            // Tratamento de Inventário (também usando Date para o campo 'date')
            const hasInventoryUpdate = updates.inventory !== undefined || updates.availableRooms !== undefined;
            if (hasInventoryUpdate) {
                const inventoryValue = Number.parseInt(updates.inventory || updates.availableRooms);
                ops.push(prisma.inventoryAdjustment.deleteMany({
                    where: { roomTypeId: currentRoomId, date: { gte: startObj, lte: endObj } }
                }));
                const invRows = dayKeysInRange.map(dateKey => ({
                    roomTypeId: currentRoomId,
                    date: new Date(`${dateKey}T00:00:00Z`),
                    totalUnits: inventoryValue
                }));
                ops.push(prisma.inventoryAdjustment.createMany({ data: invRows }));
            }
        }

        await prisma.$transaction(ops);

        return NextResponse.json({ success: true, affectedRooms: targetRoomIds.length, affectedDays: dayKeysInRange.length });
    } catch (error) {
        Sentry.captureException(error);
        console.error('[Bulk Update] ERROR:', error);
        return NextResponse.json({ error: 'BulkUpdateFailed', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}