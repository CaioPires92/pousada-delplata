import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
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
            startDate, 
            endDate, 
            updates 
        } = body;

        if (!roomTypeId || !startDate || !endDate || !updates) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Parse Dates (Local Time interpretation)
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        
        const [ey, em, ed] = endDate.split('-').map(Number);
        const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);

        await prisma.$transaction(async (tx) => {
            // 1. Fetch ALL overlapping rates
            // We get anything that touches our target range.
            const overlaps = await tx.rate.findMany({
                where: {
                    roomTypeId,
                    startDate: { lte: end },
                    endDate: { gte: start }
                }
            });

            // 2. Delete ALL overlapping rates
            // We will reconstruct the valid parts (edges) and the new middle.
            if (overlaps.length > 0) {
                await tx.rate.deleteMany({
                    where: { id: { in: overlaps.map(r => r.id) } }
                });
            }

            // 3. Restore Edges (Parts of rates that were outside the range)
            for (const r of overlaps) {
                const rStart = new Date(r.startDate);
                const rEnd = new Date(r.endDate);

                // Left Edge (Rate started before range)
                if (rStart < start) {
                    const leftEnd = new Date(start);
                    leftEnd.setDate(leftEnd.getDate() - 1);
                    leftEnd.setHours(23,59,59,999);
                    
                    await tx.rate.create({
                        data: {
                            roomTypeId: r.roomTypeId,
                            startDate: rStart,
                            endDate: leftEnd,
                            price: r.price,
                            cta: r.cta,
                            ctd: r.ctd,
                            stopSell: r.stopSell,
                            minLos: r.minLos
                        }
                    });
                }

                // Right Edge (Rate ends after range)
                if (rEnd > end) {
                    const rightStart = new Date(end);
                    rightStart.setDate(rightStart.getDate() + 1);
                    rightStart.setHours(0,0,0,0);

                    await tx.rate.create({
                        data: {
                            roomTypeId: r.roomTypeId,
                            startDate: rightStart,
                            endDate: rEnd,
                            price: r.price,
                            cta: r.cta,
                            ctd: r.ctd,
                            stopSell: r.stopSell,
                            minLos: r.minLos
                        }
                    });
                }
            }

            // 4. Reconstruct the Middle (Target Range)
            // We iterate day by day to merge existing values with updates.
            
            // Fetch base price for defaults
            const roomType = await tx.roomType.findUnique({ where: { id: roomTypeId } });
            const basePrice = Number(roomType?.basePrice) || 0;

            const days: any[] = [];
            const cursor = new Date(start);
            
            // Loop through every day of the target range
            while (cursor <= end) {
                // Find if this day was covered by an old rate
                // We assume overlaps[0] is valid if multiple exist (cleanup duplicates)
                const match = overlaps.find(r => {
                    const rStart = new Date(r.startDate);
                    const rEnd = new Date(r.endDate);
                    // Reset times for strict comparison
                    const d = new Date(cursor);
                    d.setHours(12,0,0,0);
                    
                    // Check inclusion
                    return d >= rStart && d <= rEnd;
                });

                // Determine effective values
                // If match exists, use its value. If not, use default.
                // Then override with 'updates' if provided.
                
                const currentPrice = match ? Number(match.price) : basePrice;
                const finalPrice = updates.price !== undefined ? parseFloat(updates.price) : currentPrice;

                const currentStopSell = match ? match.stopSell : false;
                const finalStopSell = updates.stopSell !== undefined ? updates.stopSell : currentStopSell;

                const currentCta = match ? match.cta : false;
                const finalCta = updates.cta !== undefined ? updates.cta : currentCta;

                const currentCtd = match ? match.ctd : false;
                const finalCtd = updates.ctd !== undefined ? updates.ctd : currentCtd;

                const currentMinLos = match ? match.minLos : 1;
                const finalMinLos = updates.minLos !== undefined ? parseInt(updates.minLos) : currentMinLos;

                days.push({
                    date: new Date(cursor),
                    price: finalPrice,
                    stopSell: finalStopSell,
                    cta: finalCta,
                    ctd: finalCtd,
                    minLos: finalMinLos
                });

                cursor.setDate(cursor.getDate() + 1);
            }

            // 5. Compress Days into Intervals
            // We group consecutive days with identical values to minimize DB records.
            if (days.length > 0) {
                const intervals: any[] = [];
                let currentInterval = {
                    start: days[0].date,
                    end: days[0].date,
                    data: days[0]
                };

                for (let i = 1; i < days.length; i++) {
                    const day = days[i];
                    const prev = currentInterval.data;

                    // Check if values are identical
                    const isSame = 
                        day.price === prev.price &&
                        day.stopSell === prev.stopSell &&
                        day.cta === prev.cta &&
                        day.ctd === prev.ctd &&
                        day.minLos === prev.minLos;

                    if (isSame) {
                        currentInterval.end = day.date;
                    } else {
                        intervals.push(currentInterval);
                        currentInterval = {
                            start: day.date,
                            end: day.date,
                            data: day
                        };
                    }
                }
                intervals.push(currentInterval);

                // 6. Insert Intervals
                for (const interval of intervals) {
                    const iStart = new Date(interval.start);
                    iStart.setHours(0,0,0,0);
                    
                    const iEnd = new Date(interval.end);
                    iEnd.setHours(23,59,59,999);

                    await tx.rate.create({
                        data: {
                            roomTypeId,
                            startDate: iStart,
                            endDate: iEnd,
                            price: interval.data.price,
                            stopSell: interval.data.stopSell,
                            cta: interval.data.cta,
                            ctd: interval.data.ctd,
                            minLos: interval.data.minLos
                        }
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error processing bulk update:', error);
        return NextResponse.json(
            { error: 'Error processing bulk update' },
            { status: 500 }
        );
    }
}
