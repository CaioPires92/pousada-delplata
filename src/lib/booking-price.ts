export type BookingPriceInput = {
    nights: number;
    baseTotalForStay: number;
    adults: number;
    childrenAges: number[];
    includedAdults?: number;
    maxGuests?: number;
    extraAdultFee: number;
    child6To11Fee: number;
    pets?: number;
};

export type BookingPriceBreakdown = {
    nights: number;
    baseTotal: number;
    effectiveAdults: number;
    childrenUnder12: number;
    extraAdults: number;
    children6To11: number;
    extrasPerNight: number;
    extraAdultTotal: number;
    childTotal: number;
    pets: number;
    petFeePerNight: number;
    petTotal: number;
    total: number;
};

export const PET_FEE_PER_NIGHT = 40;

export class BookingPriceError extends Error {
    code: 'invalid_input' | 'invalid_guests' | 'missing_children_ages' | 'capacity_exceeded';

    constructor(code: BookingPriceError['code'], message: string) {
        super(message);
        this.code = code;
    }
}

function toFiniteNumber(value: unknown) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}

function roundMoney(value: number) {
    return Math.round(value * 100) / 100;
}

export function calculateBookingPrice(input: BookingPriceInput): BookingPriceBreakdown {
    const nights = Math.trunc(toFiniteNumber(input.nights) ?? 0);
    const baseTotal = toFiniteNumber(input.baseTotalForStay) ?? 0;
    const adults = Math.trunc(toFiniteNumber(input.adults) ?? 0);


    const includedAdults = Math.trunc(toFiniteNumber(input.includedAdults ?? 2) ?? 2);
    const maxGuests = Math.trunc(toFiniteNumber(input.maxGuests ?? 3) ?? 3);
    const extraAdultFee = toFiniteNumber(input.extraAdultFee) ?? 0;
    const child6To11Fee = toFiniteNumber(input.child6To11Fee) ?? 0;
    const childrenAges = Array.isArray(input.childrenAges) ? input.childrenAges : [];
    const pets = Math.trunc(toFiniteNumber(input.pets ?? 0) ?? 0);






    if (nights <= 0) throw new BookingPriceError('invalid_input', 'Invalid nights');
    if (!Number.isFinite(baseTotal) || baseTotal < 0) throw new BookingPriceError('invalid_input', 'Invalid base price');
    if (includedAdults < 1) throw new BookingPriceError('invalid_input', 'Invalid includedAdults');
    if (maxGuests < 1) throw new BookingPriceError('invalid_input', 'Invalid maxGuests');
    if (adults < 0) throw new BookingPriceError('invalid_guests', 'Invalid adults');
    if (pets < 0 || pets > 10) throw new BookingPriceError('invalid_input', 'Invalid pets');

    const normalizedAges = childrenAges.map((a) => Math.trunc(toFiniteNumber(a) ?? -1));
    if (normalizedAges.some((a) => a < 0 || a > 17)) {
        throw new BookingPriceError('invalid_guests', 'Invalid children ages');
    }

    const adultsFromChildren = normalizedAges.filter((age) => age >= 12).length;
    const childrenUnder12Ages = normalizedAges.filter((age) => age < 12);
    const effectiveAdults = adults + adultsFromChildren;

    if (effectiveAdults < 1) throw new BookingPriceError('invalid_guests', 'Minimum 1 adult required');

    const childrenUnder12 = childrenUnder12Ages.length;
    const children6To11Count = childrenUnder12Ages.filter((age) => age >= 6 && age <= 11).length;
    const payingGuests = effectiveAdults + children6To11Count;
    const totalGuests = effectiveAdults + childrenUnder12;
    if (payingGuests > maxGuests || totalGuests > maxGuests + 1) {
        throw new BookingPriceError('capacity_exceeded', 'Capacity exceeded');
    }

    const extraAdults = Math.max(0, effectiveAdults - includedAdults);
    const includedSpotsForChildren = Math.max(0, includedAdults - effectiveAdults);
    const children6To11 = Math.max(0, children6To11Count - includedSpotsForChildren);


    console.log(`[DEBUG] Noites: ${nights} | Adultos Reais: ${adults} | Crianças 12+: ${adultsFromChildren}`);
    console.log(`[DEBUG] Adultos Totais: ${effectiveAdults} | Inclusos: ${includedAdults} | Extras: ${extraAdults}`);
    console.log(`[DEBUG] Taxas -> Adulto Extra: R$ ${extraAdultFee} | Criança 6-11: R$ ${child6To11Fee}`);


    const extrasPerNight = (extraAdults * extraAdultFee) + (children6To11 * child6To11Fee);
    const extraAdultTotal = extraAdults * extraAdultFee * nights;
    const childTotal = children6To11 * child6To11Fee * nights;
    const petTotal = pets * PET_FEE_PER_NIGHT * nights;
    const total = baseTotal + (extrasPerNight * nights) + petTotal;


    return {
        nights,
        baseTotal: roundMoney(baseTotal),
        effectiveAdults,
        childrenUnder12,
        extraAdults,
        children6To11,
        extrasPerNight: roundMoney(extrasPerNight),
        extraAdultTotal: roundMoney(extraAdultTotal),
        childTotal: roundMoney(childTotal),
        pets,
        petFeePerNight: PET_FEE_PER_NIGHT,
        petTotal: roundMoney(petTotal),
        total: roundMoney(total),
    };
}

