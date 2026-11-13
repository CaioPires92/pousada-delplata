export interface Booking {
    id: string;
    adults: number;
    children: number;
    childrenAges?: string | null;
    pets?: number;
    checkIn?: string | null;
    checkOut?: string | null;
    totalPrice: number;
    status: string;
    funnelStage?: string | null;
    funnelUpdatedAt?: string | null;
    lastErrorMessage?: string | null;
    createdAt?: string | null;
    hospedinReservationId?: string | null;
    hospedinRegisteredAt?: string | null;
    guest: {
        name: string;
        email: string;
        phone: string;
    };
    roomType: {
        name: string;
    };
    payment?: {
        status: string;
        amount: number;
        totalAmount?: number | null;
        remainingAmount?: number | null;
        paymentMode?: string | null;
        balanceDueAt?: string | null;
        balanceDueDate?: string | null;
        method?: string | null;
        cardBrand?: string | null;
        installments?: number | null;
        provider?: string | null;
    } | null;
}

export type BookingAction = 'confirm' | 'test' | 'expire' | 'assist' | 'discount' | 'payment-link' | 'hotel-confirmation' | 'delete';
