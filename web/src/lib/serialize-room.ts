import { Prisma } from '@prisma/client';

/**
 * Serializes RoomType data from Prisma to be safely passed to Client Components.
 * Converts all Prisma.Decimal fields to plain numbers.
 */
export function serializeRoomType<T extends {
    basePrice: Prisma.Decimal;
    extraAdultFee?: Prisma.Decimal | null;
    child6To11Fee?: Prisma.Decimal | null;
    [key: string]: any;
}>(room: T): Omit<T, 'basePrice' | 'extraAdultFee' | 'child6To11Fee'> & {
    basePrice: number;
    extraAdultFee: number;
    child6To11Fee: number;
} {
    return {
        ...room,
        basePrice: Number(room.basePrice),
        extraAdultFee: Number(room.extraAdultFee ?? 0),
        child6To11Fee: Number(room.child6To11Fee ?? 0),
    };
}

/**
 * Serializes an array of RoomType objects.
 */
export function serializeRoomTypes<T extends {
    basePrice: Prisma.Decimal;
    extraAdultFee?: Prisma.Decimal | null;
    child6To11Fee?: Prisma.Decimal | null;
    [key: string]: any;
}>(rooms: T[]) {
    return rooms.map(serializeRoomType);
}
