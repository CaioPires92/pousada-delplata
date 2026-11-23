import prisma from '@/lib/prisma';

/**
 * Menor preço por noite de cada quarto: o menor valor entre as tarifas de hoje em diante
 * (ignora datas com venda fechada). Sem tarifa cadastrada, usa o preço-base do quarto.
 */
export async function getRoomFromPrices(rooms: Array<{ id: string; basePrice: number }>, now = new Date()) {
    const result = new Map<string, number>();
    const ids = rooms.map((room) => room.id);
    if (ids.length === 0) return result;

    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    const rates = await prisma.rate.findMany({
        where: { roomTypeId: { in: ids }, endDate: { gte: today }, stopSell: false },
        select: { roomTypeId: true, price: true },
    });

    for (const rate of rates) {
        const price = Number(rate.price);
        if (!Number.isFinite(price) || price <= 0) continue;
        const current = result.get(rate.roomTypeId);
        if (current === undefined || price < current) result.set(rate.roomTypeId, price);
    }
    for (const room of rooms) {
        if (!result.has(room.id)) result.set(room.id, Number(room.basePrice));
    }
    return result;
}
