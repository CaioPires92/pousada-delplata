import prisma from '@/lib/prisma';

export type RoomReferencePrice = {
    price: number;
    /** Data (AAAA-MM-DD) a que o valor se refere; null quando só existe o preço-base do quarto. */
    dateKey: string | null;
    isToday: boolean;
};

/** Data de hoje no fuso de São Paulo, como AAAA-MM-DD (a pousada vende pela data local). */
export function todayKeySaoPaulo(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * Diária de referência de cada quarto: a tarifa da data mais próxima, de hoje em diante, que não esteja
 * com venda fechada. É o valor "do dia" (ou da próxima data com tarifa), nunca o menor valor do calendário,
 * para ninguém confundir um mínimo distante com o preço de hoje. Sem tarifa cadastrada, usa o preço-base.
 */
export async function getRoomReferencePrices(rooms: Array<{ id: string; basePrice: number }>, now = new Date()) {
    const result = new Map<string, RoomReferencePrice>();
    const ids = rooms.map((room) => room.id);
    if (ids.length === 0) return result;

    const todayKey = todayKeySaoPaulo(now);
    const today = new Date(`${todayKey}T00:00:00.000Z`);

    const rates = await prisma.rate.findMany({
        where: { roomTypeId: { in: ids }, endDate: { gte: today }, stopSell: false },
        select: { roomTypeId: true, price: true, startDate: true },
    });

    const best = new Map<string, { start: number; price: number }>();
    for (const rate of rates) {
        const price = Number(rate.price);
        if (!Number.isFinite(price) || price <= 0) continue;
        const start = Math.max(new Date(rate.startDate).getTime(), today.getTime());
        const current = best.get(rate.roomTypeId);
        if (!current || start < current.start || (start === current.start && price < current.price)) {
            best.set(rate.roomTypeId, { start, price });
        }
    }

    for (const room of rooms) {
        const found = best.get(room.id);
        if (found) {
            const dateKey = new Date(found.start).toISOString().slice(0, 10);
            result.set(room.id, { price: found.price, dateKey, isToday: dateKey === todayKey });
        } else {
            result.set(room.id, { price: Number(room.basePrice), dateKey: null, isToday: false });
        }
    }
    return result;
}

/** Texto curto que diz a que data o valor se refere. */
export function referencePriceLabel(reference: RoomReferencePrice) {
    if (!reference.dateKey) return 'Diária base';
    const [, month, day] = reference.dateKey.split('-');
    return reference.isToday ? `Diária de hoje · ${day}/${month}` : `Diária de ${day}/${month}`;
}
