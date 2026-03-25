import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export const runtime = 'nodejs';

type Row = Record<string, unknown>;
type DateField = 'checkIn' | 'createdAt';

type BookingQueryFilters = {
    status?: string;
    dateField: DateField;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    cursor?: string;
};

const ALLOWED_BOOKING_STATUSES = new Set([
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'EXPIRED',
    'REFUNDED',
    'PAID',
    'COMPLETED',
]);

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

function parseYmd(raw: string) {
    const value = String(raw || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    if (date.toISOString().slice(0, 10) !== value) return null;
    return date;
}

function parseBookingFilters(request: Request) {
    const params = new URL(request.url).searchParams;
    const warnings: string[] = [];
    const dateFieldRaw = String(params.get('dateField') || 'checkIn').trim();
    const dateField: DateField = dateFieldRaw === 'createdAt' ? 'createdAt' : 'checkIn';

    const statusRaw = String(params.get('status') || '').trim().toUpperCase();
    const status = statusRaw && statusRaw !== 'ALL' && ALLOWED_BOOKING_STATUSES.has(statusRaw)
        ? statusRaw
        : undefined;

    const dateFromRaw = params.get('dateFrom');
    const dateToRaw = params.get('dateTo');
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (dateFromRaw || dateToRaw) {
        const parsedFrom = dateFromRaw ? parseYmd(dateFromRaw) : null;
        const parsedTo = dateToRaw ? parseYmd(dateToRaw) : null;

        if (!parsedFrom || !parsedTo) {
            warnings.push('Invalid dateFrom/dateTo received. Falling back to unfiltered date range.');
        } else {
            dateFrom = parsedFrom;
            dateTo = new Date(parsedTo);
            dateTo.setUTCHours(23, 59, 59, 999);

            if (dateFrom.getTime() > dateTo.getTime()) {
                warnings.push('dateFrom > dateTo received. Falling back to unfiltered date range.');
                dateFrom = undefined;
                dateTo = undefined;
            }
        }
    }

    const limitRaw = params.get('limit');
    let limit: number | undefined;
    if (limitRaw) {
        const parsed = Number.parseInt(limitRaw, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            limit = Math.min(parsed, 500);
        }
    }

    const cursorRaw = String(params.get('cursor') || '').trim();
    const cursor = cursorRaw || undefined;

    const filters: BookingQueryFilters = {
        status,
        dateField,
        dateFrom,
        dateTo,
        limit,
        cursor,
    };

    return { filters, warnings };
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

async function fetchBookingsViaPrisma(filters: BookingQueryFilters) {
    const where: Prisma.BookingWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom && filters.dateTo) {
        const dateRange = {
            gte: filters.dateFrom,
            lte: filters.dateTo,
        };
        if (filters.dateField === 'checkIn') {
            where.checkIn = dateRange;
        } else {
            where.createdAt = dateRange;
        }
    }

    const runQuery = async (withCursor: boolean) =>
        prisma.booking.findMany({
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
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: filters.limit,
            ...(withCursor && filters.cursor
                ? {
                      cursor: { id: filters.cursor },
                      skip: 1,
                  }
                : {}),
        });

    let bookings;
    try {
        bookings = await runQuery(Boolean(filters.cursor));
    } catch (error) {
        if (filters.cursor && isPrismaQueryError(error)) {
            console.warn('[Admin Bookings] Invalid cursor, retrying without cursor.');
            bookings = await runQuery(false);
        } else {
            throw error;
        }
    }

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

function toDate(value: unknown) {
    const parsed = new Date(String(value || ''));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchBookingsViaRawSql(filters: BookingQueryFilters) {
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

    const normalized = bookingRows.map((booking) => {
        const guestId = String(booking.guestId || '').trim();
        const roomTypeId = String(booking.roomTypeId || '').trim();
        const bookingId = String(booking.id || '').trim();
        const guest = guestId ? guestsById.get(guestId) : undefined;
        const roomType = roomTypeId ? roomTypesById.get(roomTypeId) : undefined;
        const payment = bookingId ? paymentsByBookingId.get(bookingId) : null;
        return normalizeBooking(booking, guest, roomType, payment || null);
    });

    const filtered = normalized.filter((booking) => {
        if (filters.status && String(booking.status || '').toUpperCase() !== filters.status) return false;

        if (filters.dateFrom && filters.dateTo) {
            const primaryDate = filters.dateField === 'checkIn' ? toDate(booking.checkIn) : toDate(booking.createdAt);
            const fallbackDate = toDate(booking.createdAt);
            const dateToCompare = primaryDate || fallbackDate;
            if (!dateToCompare) return false;
            if (dateToCompare.getTime() < filters.dateFrom.getTime()) return false;
            if (dateToCompare.getTime() > filters.dateTo.getTime()) return false;
        }

        return true;
    });

    filtered.sort((a, b) => {
        const aTime = toDate(a.createdAt)?.getTime() || 0;
        const bTime = toDate(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
    });

    const startIndex = filters.cursor
        ? Math.max(0, filtered.findIndex((item) => item.id === filters.cursor) + 1)
        : 0;
    const sliced = filtered.slice(startIndex);

    if (!filters.limit) return sliced;
    return sliced.slice(0, filters.limit);
}

export async function GET(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;
        const { filters, warnings } = parseBookingFilters(request);
        if (warnings.length > 0) {
            console.warn('[Admin Bookings] Query warnings:', warnings.join(' | '));
        }

        try {
            const bookings = await fetchBookingsViaPrisma(filters);
            return NextResponse.json(bookings);
        } catch (prismaError) {
            console.warn('[Admin Bookings] Prisma query failed, trying raw SQL fallback.', prismaError);
            if (!isPrismaQueryError(prismaError)) throw prismaError;

            const bookings = await fetchBookingsViaRawSql(filters);
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
