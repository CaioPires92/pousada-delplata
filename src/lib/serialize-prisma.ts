import { Prisma } from "@prisma/client";

export function serializePrisma(value: any): any {
    if (value === null || value === undefined) return value;

    if (Prisma.Decimal.isDecimal(value)) return value.toNumber();

    if (value instanceof Date) return value.toISOString();

    if (typeof value === "bigint") return value.toString(); // importante

    if (Array.isArray(value)) return value.map(serializePrisma);

    if (typeof value === "object") {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = serializePrisma(v);
        }
        return out;
    }

    return value;
}

/**
 * Type-safe wrapper for serializing single Prisma entity
 */
export function serializePrismaEntity<T extends Record<string, any>>(entity: T): T {
    return serializePrisma(entity) as T;
}

/**
 * Type-safe wrapper for serializing array of Prisma entities
 */
export function serializePrismaArray<T extends Record<string, any>>(entities: T[]): T[] {
    return serializePrisma(entities) as T[];
}
