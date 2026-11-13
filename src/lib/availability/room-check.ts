import prisma from '@/lib/prisma';
import { queryAvailabilityQuote } from '@/lib/availability/quote-service';

type BookingForRoomCheck = {
    roomTypeId: string;
    checkIn: Date;
    checkOut: Date;
    adults: number;
    childrenAges: string | null;
    pets?: number | null;
};

function parseChildrenAges(value: string | null) {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
        return [];
    }
}

// Ainda existe um quarto para esta reserva? Usa a mesma cotação do site (estoque, ajustes do
// Hospedin, stop-sell). Conservador: qualquer dúvida responde false e a equipe decide.
// A própria reserva não entra na conta quando está pendente fora do prazo.
export async function hasRoomForBooking(booking: BookingForRoomCheck, client: unknown = prisma) {
    try {
        const result = await queryAvailabilityQuote({
            checkin: booking.checkIn.toISOString().slice(0, 10),
            checkout: booking.checkOut.toISOString().slice(0, 10),
            adults: booking.adults,
            childrenAges: parseChildrenAges(booking.childrenAges),
            pets: booking.pets ?? 0,
        }, client as typeof prisma);
        if (!result.ok) return false;
        return result.options.some((option) => option.roomTypeId === booking.roomTypeId && option.remainingUnits >= 1);
    } catch {
        return false;
    }
}
