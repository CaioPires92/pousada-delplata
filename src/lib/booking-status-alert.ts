import { sendBookingCreatedAlertEmail } from '@/lib/email';

type BookingStatusAlertData = {
    id: string;
    guest: {
        name: string;
        email: string;
        phone?: string | null;
    };
    roomType: {
        name: string;
    };
    checkIn: Date;
    checkOut: Date;
    totalPrice: unknown;
    adults?: number | null;
    children?: number | null;
    childrenAges?: string | number[] | null;
    createdAt?: Date;
    payment?: {
        method?: string | null;
        installments?: number | null;
        status?: string | null;
        paymentMode?: string | null;
        amount?: unknown;
        remainingAmount?: unknown;
        balanceDueAt?: string | null;
        balanceDueDate?: Date | null;
    } | null;
};

function toNumberOrNull(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export async function sendBookingStatusAlertEmail(
    booking: BookingStatusAlertData,
    params: {
        bookingStatus: string;
        paymentStatus?: string | null;
    }
) {
    const paidAmount = toNumberOrNull(booking.payment?.amount);
    const remainingAmount = toNumberOrNull(booking.payment?.remainingAmount);

    return sendBookingCreatedAlertEmail({
        guestName: booking.guest.name,
        guestEmail: booking.guest.email,
        guestPhone: booking.guest.phone || null,
        bookingId: booking.id,
        roomName: booking.roomType.name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalPrice: Number(booking.totalPrice),
        paymentMethod: booking.payment?.method || null,
        paymentInstallments: booking.payment?.installments ?? null,
        paymentMode: booking.payment?.paymentMode || null,
        paidAmount,
        remainingAmount,
        balanceDueAt: booking.payment?.balanceDueAt || null,
        balanceDueDate: booking.payment?.balanceDueDate || null,
        adults: booking.adults,
        children: booking.children,
        childrenAges: booking.childrenAges,
        bookingStatus: params.bookingStatus,
        paymentStatus: params.paymentStatus || booking.payment?.status || params.bookingStatus,
        bookingCreatedAt: booking.createdAt,
    });
}

