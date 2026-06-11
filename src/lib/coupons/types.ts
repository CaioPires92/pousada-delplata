export type CouponValidationReason =
    | 'OK'
    | 'INVALID_CODE'
    | 'INACTIVE'
    | 'NOT_STARTED'
    | 'EXPIRED'
    | 'MIN_BOOKING_NOT_REACHED'
    | 'USAGE_LIMIT_REACHED'
    | 'INVALID_COUPON_CONFIG'
    | 'MISSING_SUBTOTAL';

export type CouponValidationInput = {
    code: string;
    subtotal: number;
    now?: Date;
    guestEmail?: string;
    guestPhone?: string;
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