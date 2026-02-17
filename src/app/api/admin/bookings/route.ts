import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export const runtime = 'nodejs';

type Row = Record<string, unknown>;

function isPrismaQueryError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError;
}

function toNumber(value: unknown, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function toInt(value: unknown, fallback = 0) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function quoteIdentifier(identifier: string) {
    return `"${identifier.replace(/"/g, '""')}"`;
}

function uniqueStrings(values: unknown[]) {
    return Array.from(
        new Set(
            values
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        )
    );
}

function mapByField(rows: Row[], field: string) {
    const map = new Map<string, Row>();
    for (const row of rows) {
        const key = String(row[field] || '').trim();
        if (key) map.set(key, row);
    }
    return map;
}

function normalizeBooking(booking: Row, guest?: Row, roomType?: Row, payment?: Row | null) {
    return {
        id: String(booking.id || ''),
        adults: Math.max(0, toInt(booking.adults, 1)),
        children: Math.max(0, toInt(booking.children, 0)),
        childrenAges: typeof booking.childrenAges === 'string' ? booking.childrenAges : null,
        checkIn: booking.checkIn ?? null,
        checkOut: booking.checkOut ?? null,
        totalPrice: toNumber(booking.totalPrice, 0),
        status: String(booking.status || ''),
        createdAt: booking.createdAt ?? null,
        guest: {
            name: String(guest?.name || 'Não informado'),
            email: String(guest?.email || '-'),
            phone: String(guest?.phone || '-'),
        },
        roomType: {
            name: String(roomType?.name || 'Não informado'),
        },
        payment: payment
            ? {
                  status: String(payment.status || ''),
                  amount: toNumber(payment.amount, 0),
                  method: payment.method ?? null,
                  cardBrand: payment.cardBrand ?? null,
                  installments: payment.installments == null ? null : Math.max(0, toInt(payment.installments, 0)),
                  provider: payment.provider ?? null,
              }
            : null,
    };
}

async function tableExists(table: string) {
    const rows = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
        table
    );
    return rows.length > 0;
}

async function getTableColumns(table: string) {
    try {
        const rows = await prisma.$queryRawUnsafe<Row[]>(`PRAGMA table_info(${quoteIdentifier(table)})`);
        return new Set(
            rows
                .map((row) => String(row.name || '').trim())
                .filter(Boolean)
        );
    } catch {
        return new Set<string>();
    }
}

function pickColumns(wanted: string[], existing: Set<string>) {
    return wanted.filter((column) => existing.has(column));
}

async function fetchBookingsViaPrisma() {
    const bookings = await prisma.booking.findMany({
        select: {
            id: true,
            adults: true,
            children: true,
            childrenAges: true,
            checkIn: true,
            checkOut: true,
            totalPrice: true,
            status: true,
            createdAt: true,
            guest: {
                select: {
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            roomType: {
                select: {
                    name: true,
                },
            },
            payment: {
                select: {
                    status: true,
                    amount: true,
                    method: true,
                    cardBrand: true,
                    installments: true,
                    provider: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return bookings.map((booking) =>
        normalizeBooking(
            booking as unknown as Row,
            booking.guest as unknown as Row,
            booking.roomType as unknown as Row,
            booking.payment ? (booking.payment as unknown as Row) : null
        )
    );
}

async function fetchRowsByIds(params: {
    table: string;
    idField: string;
    ids: unknown[];
    wantedColumns: string[];
}) {
    const ids = uniqueStrings(params.ids);
    if (ids.length === 0) return [] as Row[];
    if (!(await tableExists(params.table))) return [] as Row[];

    const existingColumns = await getTableColumns(params.table);
    const columns = pickColumns(params.wantedColumns, existingColumns);
    if (!columns.includes(params.idField)) return [] as Row[];

    const placeholders = ids.map(() => '?').join(', ');
    const sql = `SELECT ${columns.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(params.table)} WHERE ${quoteIdentifier(params.idField)} IN (${placeholders})`;
    return prisma.$queryRawUnsafe<Row[]>(sql, ...ids);
}

async function fetchBookingsViaRawSql() {
    if (!(await tableExists('Booking'))) return [] as ReturnType<typeof normalizeBooking>[];

    const bookingColumns = await getTableColumns('Booking');
    if (!bookingColumns.has('id')) return [] as ReturnType<typeof normalizeBooking>[];

    const wantedBookingColumns = [
        'id',
        'guestId',
        'roomTypeId',
        'adults',
        'children',
        'childrenAges',
        'checkIn',
        'checkOut',
        'totalPrice',
        'status',
        'createdAt',
    ];
    const selectedBookingColumns = pickColumns(wantedBookingColumns, bookingColumns);
    const orderBy = bookingColumns.has('createdAt') ? quoteIdentifier('createdAt') : 'rowid';
    const bookingsSql = `SELECT ${selectedBookingColumns.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier('Booking')} ORDER BY ${orderBy} DESC`;
    const bookingRows = await prisma.$queryRawUnsafe<Row[]>(bookingsSql);

    const guestRows = await fetchRowsByIds({
        table: 'Guest',
        idField: 'id',
        ids: bookingRows.map((row) => row.guestId),
        wantedColumns: ['id', 'name', 'email', 'phone'],
    });
    const guestsById = mapByField(guestRows, 'id');

    const roomTypeRows = await fetchRowsByIds({
        table: 'RoomType',
        idField: 'id',
        ids: bookingRows.map((row) => row.roomTypeId),
        wantedColumns: ['id', 'name'],
    });
    const roomTypesById = mapByField(roomTypeRows, 'id');

    const paymentRows = await fetchRowsByIds({
        table: 'Payment',
        idField: 'bookingId',
        ids: bookingRows.map((row) => row.id),
        wantedColumns: ['bookingId', 'status', 'amount', 'method', 'cardBrand', 'installments', 'provider'],
    });
    const paymentsByBookingId = mapByField(paymentRows, 'bookingId');

    return bookingRows.map((booking) => {
        const guestId = String(booking.guestId || '').trim();
        const roomTypeId = String(booking.roomTypeId || '').trim();
        const bookingId = String(booking.id || '').trim();
        const guest = guestId ? guestsById.get(guestId) : undefined;
        const roomType = roomTypeId ? roomTypesById.get(roomTypeId) : undefined;
        const payment = bookingId ? paymentsByBookingId.get(bookingId) : null;
        return normalizeBooking(booking, guest, roomType, payment || null);
    });
}

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        try {
            const bookings = await fetchBookingsViaPrisma();
            return NextResponse.json(bookings);
        } catch (prismaError) {
            console.warn('[Admin Bookings] Prisma query failed, trying raw SQL fallback.', prismaError);
            if (!isPrismaQueryError(prismaError)) throw prismaError;

            const bookings = await fetchBookingsViaRawSql();
            return NextResponse.json(bookings);
        }
    } catch (error) {
        console.error('[Admin Bookings] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar reservas' },
            { status: 500 }
        );
    }
}
