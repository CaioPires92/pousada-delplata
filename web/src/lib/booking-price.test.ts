import { describe, it, expect } from 'vitest';
import { calculateBookingPrice, BookingPriceError } from '@/lib/booking-price';

describe('calculateBookingPrice', () => {
    it('keeps base total for 2 adults included', () => {
        const breakdown = calculateBookingPrice({
            nights: 2,
            baseTotalForStay: 500,
            adults: 2,
            childrenAges: [],
            includedAdults: 2,
            maxGuests: 3,
            extraAdultFee: 50,
            child6To11Fee: 30,
        });

        expect(breakdown.extraAdults).toBe(0);
        expect(breakdown.children6To11).toBe(0);
        expect(breakdown.total).toBe(500);
    });

    it('charges extra adult fee for 3rd adult', () => {
        const breakdown = calculateBookingPrice({
            nights: 3,
            baseTotalForStay: 600,
            adults: 3,
            childrenAges: [],
            includedAdults: 2,
            maxGuests: 3,
            extraAdultFee: 40,
            child6To11Fee: 25,
        });

        expect(breakdown.extraAdults).toBe(1);
        expect(breakdown.extrasPerNight).toBe(40);
        expect(breakdown.total).toBe(720);
    });

    it('charges child 6-11 fee per night', () => {
        const breakdown = calculateBookingPrice({
            nights: 2,
            baseTotalForStay: 400,
            adults: 2,
            childrenAges: [8],
            includedAdults: 2,
            maxGuests: 3,
            extraAdultFee: 50,
            child6To11Fee: 30,
        });

        expect(breakdown.children6To11).toBe(1);
        expect(breakdown.extrasPerNight).toBe(30);
        expect(breakdown.total).toBe(460);
    });

    it('treats child 12+ as adult for included adults and extra adult', () => {
        const breakdown = calculateBookingPrice({
            nights: 1,
            baseTotalForStay: 200,
            adults: 2,
            childrenAges: [12],
            includedAdults: 2,
            maxGuests: 3,
            extraAdultFee: 70,
            child6To11Fee: 30,
        });

        expect(breakdown.effectiveAdults).toBe(3);
        expect(breakdown.childrenUnder12).toBe(0);
        expect(breakdown.extraAdults).toBe(1);
        expect(breakdown.total).toBe(270);
    });

    it('rejects when capacity is exceeded after age conversion', () => {
        expect(() =>
            calculateBookingPrice({
                nights: 1,
                baseTotalForStay: 100,
                adults: 3,
                childrenAges: [6],
                includedAdults: 2,
                maxGuests: 3,
                extraAdultFee: 10,
                child6To11Fee: 10,
            })
        ).toThrowError(BookingPriceError);
    });

    it('rejects when no adults are present after conversion', () => {
        expect(() =>
            calculateBookingPrice({
                nights: 1,
                baseTotalForStay: 100,
                adults: 0,
                childrenAges: [5],
                includedAdults: 2,
                maxGuests: 3,
                extraAdultFee: 10,
                child6To11Fee: 10,
            })
        ).toThrowError(BookingPriceError);
    });

    // NEW TESTS FROM PLAN

    it('should not charge for children under 6', () => {
        const breakdown = calculateBookingPrice({
            nights: 2,
            baseTotalForStay: 400,
            adults: 2,
            childrenAges: [3, 5], // Both under 6
            includedAdults: 2,
            maxGuests: 4,
            extraAdultFee: 50,
            child6To11Fee: 30,
        });

        expect(breakdown.children6To11).toBe(0);
        expect(breakdown.childTotal).toBe(0);
        expect(breakdown.extrasPerNight).toBe(0);
        expect(breakdown.total).toBe(400); // Only base price
    });

    it('should correctly calculate pricing for mixed children ages (4, 8, 13)', () => {
        const breakdown = calculateBookingPrice({
            nights: 2,
            baseTotalForStay: 400,
            adults: 2,
            childrenAges: [4, 8, 13], // 4=free, 8=child fee, 13=adult
            includedAdults: 2,
            maxGuests: 5,
            extraAdultFee: 100,
            child6To11Fee: 80,
        });

        // 13 year old counted as adult
        expect(breakdown.effectiveAdults).toBe(3); // 2 adults + 1 from age 13
        expect(breakdown.childrenUnder12).toBe(2); // ages 4 and 8
        expect(breakdown.children6To11).toBe(1); // Only age 8
        expect(breakdown.extraAdults).toBe(1); // 3 effective - 2 included = 1 extra

        // Calculations: 1 extra adult (100*2 nights) + 1 child 6-11 (80*2 nights)
        expect(breakdown.extraAdultTotal).toBe(200);
        expect(breakdown.childTotal).toBe(160);
        expect(breakdown.extrasPerNight).toBe(180); // 100 + 80
        expect(breakdown.total).toBe(760); // 400 base + 360 extras
    });

    it('should reject when child 12+ converts to adult exceeding maxGuests', () => {
        expect(() =>
            calculateBookingPrice({
                nights: 1,
                baseTotalForStay: 200,
                adults: 2,
                childrenAges: [12, 8], // 12 becomes adult, 8 stays child
                includedAdults: 2,
                maxGuests: 3, // 2 adults + 1 from age 12 + 1 child = 4 guests > 3 max
                extraAdultFee: 50,
                child6To11Fee: 30,
            })
        ).toThrowError(BookingPriceError);
    });

    it('should correctly multiply extra fees by number of nights', () => {
        const breakdown = calculateBookingPrice({
            nights: 3,
            baseTotalForStay: 900, // 300 per night * 3
            adults: 3,
            childrenAges: [8],
            includedAdults: 2,
            maxGuests: 4,
            extraAdultFee: 100,
            child6To11Fee: 80,
        });

        expect(breakdown.nights).toBe(3);
        expect(breakdown.extraAdults).toBe(1);
        expect(breakdown.children6To11).toBe(1);
        expect(breakdown.extrasPerNight).toBe(180); // 100 + 80 per night
        expect(breakdown.extraAdultTotal).toBe(300); // 100 * 3 nights
        expect(breakdown.childTotal).toBe(240); // 80 * 3 nights
        expect(breakdown.total).toBe(1440); // 900 + (180 * 3)
    });

    it('should reject when nights is 0 or negative', () => {
        expect(() =>
            calculateBookingPrice({
                nights: 0,
                baseTotalForStay: 100,
                adults: 2,
                childrenAges: [],
                includedAdults: 2,
                maxGuests: 3,
                extraAdultFee: 50,
                child6To11Fee: 30,
            })
        ).toThrowError(BookingPriceError);

        expect(() =>
            calculateBookingPrice({
                nights: -1,
                baseTotalForStay: 100,
                adults: 2,
                childrenAges: [],
                includedAdults: 2,
                maxGuests: 3,
                extraAdultFee: 50,
                child6To11Fee: 30,
            })
        ).toThrowError(BookingPriceError);
    });

    it('should allow booking when guests equal maxGuests and reject when exceeding', () => {
        // Exactly at capacity - should PASS
        const atCapacity = calculateBookingPrice({
            nights: 1,
            baseTotalForStay: 100,
            adults: 2,
            childrenAges: [8], // Total: 2 adults + 1 child = 3
            includedAdults: 2,
            maxGuests: 3,
            extraAdultFee: 50,
            child6To11Fee: 30,
        });
        expect(atCapacity.total).toBe(130); // Valid booking

        // Over capacity - should FAIL
        expect(() =>
            calculateBookingPrice({
                nights: 1,
                baseTotalForStay: 100,
                adults: 2,
                childrenAges: [8, 9], // Total: 2 adults + 2 children = 4 > 3 max
                includedAdults: 2,
                maxGuests: 3,
                extraAdultFee: 50,
                child6To11Fee: 30,
            })
        ).toThrowError(BookingPriceError);
    });

    it('should apply extras per-night correctly (multi-night validation)', () => {
        const breakdown = calculateBookingPrice({
            nights: 2,
            baseTotalForStay: 600,
            adults: 3,
            childrenAges: [],
            includedAdults: 2,
            maxGuests: 3,
            extraAdultFee: 100,
            child6To11Fee: 80,
        });

        // Rule: extras are per-night, multiplied by nights
        expect(breakdown.extrasPerNight).toBe(100); // 1 extra adult * 100
        expect(breakdown.extraAdultTotal).toBe(200); // 100 per night * 2 nights
        expect(breakdown.total).toBe(800); // 600 base + 200 extras
    });
});


