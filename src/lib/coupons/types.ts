export type CouponValidationReason =
    | 'OK'
    | 'INVALID_CODE'
    | 'INACTIVE'
    | 'NOT_STARTED'
    | 'EXPIRED'
    | 'GUEST_NOT_ELIGIBLE'
    | 'MIN_BOOKING_NOT_REACHED'
    | 'USAGE_LIMIT_REACHED'
    | 'STAY_DATE_BLOCKED'
    | 'INVALID_COUPON_CONFIG'
    | 'MISSING_SUBTOTAL';

export type CouponValidationInput = {
    code: string;
    subtotal: number;
    now?: Date;
    guestEmail?: string;
    guestPhone?: string;
    roomTypeId?: string;
    source?: string;
    checkIn?: Date | string;
    checkOut?: Date | string;
    blockedDateRanges?: Array<{ start: string; end: string; label: string }>;
    preview?: boolean;
};

export type CouponValidationResult = {
    valid: boolean;
    reason: CouponValidationReason;
    couponId?: string;
    couponType?: 'PERCENT' | 'FIXED';
    couponValue?: number;
    discountAmount?: number;
    subtotal?: number;
    total?: number;
    message?: string;
};
