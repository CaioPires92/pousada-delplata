export interface Booking {
    id: string;
    adults: number;
    children: number;
    childrenAges?: string | null;
    checkIn?: string | null;
    checkOut?: string | null;
    totalPrice: number;
    status: string;
    createdAt?: string | null;
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
        method?: string | null;
        cardBrand?: string | null;
        installments?: number | null;
        provider?: string | null;
    } | null;
}

export type BookingAction = 'confirm' | 'test' | 'expire' | 'assist' | 'delete';
