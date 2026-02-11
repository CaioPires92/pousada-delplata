export type CouponValidationReason =
    | 'OK'
    | 'INVALID_CODE'
    | 'INACTIVE'
    | 'NOT_STARTED'
    | 'EXPIRED'
    | 'MIN_BOOKING_NOT_REACHED'
    | 'GUEST_NOT_ELIGIBLE'
    | 'ROOM_NOT_ELIGIBLE'
    | 'SOURCE_NOT_ELIGIBLE'
    | 'USAGE_LIMIT_REACHED'
    | 'GUEST_USAGE_LIMIT_REACHED'
    | 'INVALID_COUPON_CONFIG'
    | 'MISSING_SUBTOTAL';

export type CouponValidationInput = {
    code: string;
    subtotal: number;
    guestEmail?: string;
    guestPhone?: string;
    roomTypeId?: string;
    source?: string;
    now?: Date;
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