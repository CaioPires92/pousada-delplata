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
        const auth = await requireAdminAuth();
        if (auth) return auth;

        const text = await request.text();
        if (!text) {
             return NextResponse.json(
                { error: 'Request body is empty' },
                { status: 400 }
            );
        }
        
        const body = JSON.parse(text);
        const { 
            roomTypeId, 
            roomTypes, // Support new field name for array
            date,
            startDate, 
            endDate, 
            updates 
        } = body;
        const effectiveStartDate = (date || startDate) as string | undefined;
        const effectiveEndDate = (date || endDate) as string | undefined;
        ctxStartDate = effectiveStartDate;
        ctxEndDate = effectiveEndDate;

        // Allow roomTypeId OR roomTypes
        if ((!roomTypeId && !roomTypes) || !effectiveStartDate || !effectiveEndDate || !updates) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        try {
            assertDayKey(effectiveStartDate, 'startDate');
            assertDayKey(effectiveEndDate, 'endDate');
        } catch (e) {
            return NextResponse.json(
                { error: e instanceof Error ? e.message : 'Invalid date format. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        const startStr = effectiveStartDate as string;
        const endStr = effectiveEndDate as string;

        // Identify target room IDs
        let targetRoomIds: string[] = [];
        
        // Handle "all" case or specific ID(s)
        const targetInput = roomTypes || roomTypeId;

        if (targetInput === 'all' || (Array.isArray(targetInput) && targetInput.includes('all'))) {
            const allRooms = await prisma.roomType.findMany({ select: { id: true } });
            targetRoomIds = allRooms.map(r => r.id);
        } else if (Array.isArray(targetInput)) {
            targetRoomIds = targetInput;
        } else {
            targetRoomIds = [targetInput];
        }

        if (targetRoomIds.length === 0) {
             return NextResponse.json(
                { error: 'No valid room types selected' },
                { status: 400 }
            );
        }
        ctxTargetCount = targetRoomIds.length;

        const hasPriceUpdate = updates.price !== undefined && updates.price !== null && updates.price !== '';
        const priceValue = hasPriceUpdate ? Number(updates.price) : undefined;
        if (hasPriceUpdate && (Number.isNaN(priceValue) || priceValue! < 0)) {
            return NextResponse.json(
                { error: 'Invalid price value. Must be a number >= 0.' },
                { status: 400 }
            );
        }

        const hasMinLosUpdate = updates.minLos !== undefined && updates.minLos !== null && updates.minLos !== '';
        const minLosValue = hasMinLosUpdate ? Number.parseInt(updates.minLos) : undefined;
        if (hasMinLosUpdate && (Number.isNaN(minLosValue) || minLosValue! < 1)) {
            return NextResponse.json(
                { error: 'Invalid minLos value. Must be an integer >= 1.' },
                { status: 400 }
            );
        }

        for (const key of ['stopSell', 'cta', 'ctd'] as const) {
            if (updates[key] !== undefined && updates[key] !== null && updates[key] !== '' && typeof updates[key] !== 'boolean') {
                return NextResponse.json(
                    { error: `Invalid ${key} value. Must be boolean.` },
                    { status: 400 }
                );
            }
        }

        const inventoryInput = updates.inventory !== undefined ? updates.inventory : updates.availableRooms;
        const hasInventoryUpdate = inventoryInput !== undefined && inventoryInput !== null && inventoryInput !== '';
        const inventoryValue = hasInventoryUpdate ? Number.parseInt(inventoryInput) : undefined;
        if (hasInventoryUpdate && (Number.isNaN(inventoryValue) || inventoryValue! < 0)) {
            return NextResponse.json(
                { error: 'Invalid inventory value. Must be an integer >= 0.' },
                { status: 400 }
            );
        }

        const roomTypeRows = await prisma.roomType.findMany({
            where: { id: { in: targetRoomIds } },
            select: { id: true, basePrice: true }
        });
        const basePriceByRoomId = new Map(roomTypeRows.map(r => [r.id, Number(r.basePrice) || 0]));

        const ops: any[] = [];
        const dayKeysInRange = eachDayKeyInclusive(startStr, endStr);
        const dayCount = dayKeysInRange.length;

        console.log(`[Bulk Update] Building operations for ${targetRoomIds.length} rooms and ${dayCount} days`);

        for (const currentRoomId of targetRoomIds) {
            if (!basePriceByRoomId.has(currentRoomId)) {
                return NextResponse.json(
                    { error: `RoomType not found: ${currentRoomId}` },
                    { status: 400 }
                );
            }

            const basePrice = basePriceByRoomId.get(currentRoomId)!;

            const overlaps = await prisma.rate.findMany({
                where: {
                    roomTypeId: currentRoomId,
                    startDate: { lte: endStr },
                    endDate: { gte: startStr }
                }
            });

            const dayMap = new Map<string, any>();
            for (const r of overlaps) {
                for (const dateKey of eachDayKeyInclusive(r.startDate, r.endDate)) {
                    dayMap.set(dateKey, {
                        price: Number(r.price),
                        stopSell: r.stopSell,
                        cta: r.cta,
                        ctd: r.ctd,
                        minLos: r.minLos
                    });
                }
            }

            for (const dateKey of dayKeysInRange) {
                const existing = dayMap.get(dateKey) || {
                    price: basePrice,
                    stopSell: false,
                    cta: false,
                    ctd: false,
                    minLos: 1
                };

                const updated = {
                    price: hasPriceUpdate ? priceValue : existing.price,
                    stopSell: updates.stopSell !== undefined && updates.stopSell !== '' ? updates.stopSell : existing.stopSell,
                    cta: updates.cta !== undefined && updates.cta !== '' ? updates.cta : existing.cta,
                    ctd: updates.ctd !== undefined && updates.ctd !== '' ? updates.ctd : existing.ctd,
                    minLos: hasMinLosUpdate ? minLosValue : existing.minLos,
                };
                dayMap.set(dateKey, updated);
            }

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
                const isSameData =
                    data.price === currentInterval.data.price &&
                    data.stopSell === currentInterval.data.stopSell &&
                    data.cta === currentInterval.data.cta &&
                    data.ctd === currentInterval.data.ctd &&
                    data.minLos === currentInterval.data.minLos;
                if (isConsecutive && isSameData) {
                    currentInterval.end = dateKey;
                } else {
                    intervals.push(currentInterval);
                    currentInterval = { start: dateKey, end: dateKey, data };
                }
            }
            if (currentInterval) intervals.push(currentInterval);

            if (overlaps.length > 0) {
                ops.push(prisma.rate.deleteMany({ where: { id: { in: overlaps.map(o => o.id) } } }));
            }

            if (intervals.length > 0) {
                const rateRows = intervals.map(interval => {
                    return {
                        roomTypeId: currentRoomId,
                        startDate: interval.start,
                        endDate: interval.end,
                        price: interval.data.price,
                        stopSell: interval.data.stopSell,
                        cta: interval.data.cta,
                        ctd: interval.data.ctd,
                        minLos: interval.data.minLos
                    };
                });
                ops.push(prisma.rate.createMany({ data: rateRows }));
            }

            if (hasInventoryUpdate) {
                ops.push(
                    prisma.inventoryAdjustment.deleteMany({
                        where: { roomTypeId: currentRoomId, date: { gte: startStr, lte: endStr } }
                    })
                );
                const invRows = [];
                for (const dateKey of dayKeysInRange) {
                    invRows.push({ roomTypeId: currentRoomId, date: dateKey, totalUnits: inventoryValue! });
                }
                ops.push(prisma.inventoryAdjustment.createMany({ data: invRows }));
            }
        }

        await prisma.$transaction(ops);

        opsLog('info', 'RATES_BULK_SUCCESS', {
            startDate: ctxStartDate,
            endDate: ctxEndDate,
            affectedRooms: targetRoomIds.length,
            affectedDays: dayCount,
        });
        return NextResponse.json({
            success: true,
            affectedRooms: targetRoomIds.length,
            affectedDays: dayCount
        });
    } catch (error) {
        const isDev = process.env.NODE_ENV !== 'production';
        const err = error as any;
        const message = error instanceof Error ? error.message : 'Error processing bulk update';
        const name = typeof err?.name === 'string' ? err.name : 'UnknownError';
        const code = typeof err?.code === 'string' ? err.code : undefined;

        Sentry.captureException(error);
        console.error('[Bulk Update] ERROR:', { name, code, message });
        if (isDev) {
            console.error('[Bulk Update] RAW ERROR:', error);
            if (error instanceof Error && error.stack) {
                console.error('[Bulk Update] STACK:\n' + error.stack);
            }
        }

        const details =
            err && typeof err === 'object'
                ? {
                      name,
                      code,
                      meta: err.meta,
                      clientVersion: err.clientVersion,
                  }
                : { name, code };

        const status =
            code === 'P2002'
                ? 409
                : code === 'P2028'
                  ? 503
                  : message.includes('Invalid date format')
                    ? 400
                    : 500;

        opsLog('error', 'RATES_BULK_ERROR', {
            startDate: ctxStartDate,
            endDate: ctxEndDate,
            targetRooms: ctxTargetCount,
            errorName: name,
            errorCode: code,
            message,
            status,
        });
        return NextResponse.json(
            {
                error: 'BulkUpdateFailed',
                message,
                details,
                ...(isDev ? { stack: error instanceof Error ? error.stack : undefined } : {}),
            },
            { status }
        );
    }
}
