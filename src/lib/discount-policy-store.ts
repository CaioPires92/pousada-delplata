import prisma from '@/lib/prisma';
import {
    DEFAULT_DISCOUNT_POLICY,
    normalizeDiscountPolicy,
    parseBlockedDateRanges,
    type DiscountPolicy,
} from '@/lib/discount-policy';

export const DISCOUNT_POLICY_ID = 'default';

export async function getDiscountPolicy(): Promise<DiscountPolicy> {
    const settings = await prisma.discountPolicySettings.findUnique({
        where: { id: DISCOUNT_POLICY_ID },
    });

    if (!settings) return DEFAULT_DISCOUNT_POLICY;
    return normalizeDiscountPolicy({
        sendEnabled: settings.sendEnabled,
        percentage: settings.percentage,
        validityDays: settings.validityDays,
        minimumBookingValue: settings.minimumBookingValue == null ? null : Number(settings.minimumBookingValue),
        maximumDiscountAmount: settings.maximumDiscountAmount == null ? null : Number(settings.maximumDiscountAmount),
        blockedDateRanges: parseBlockedDateRanges(settings.blockedDateRanges),
    });
}
