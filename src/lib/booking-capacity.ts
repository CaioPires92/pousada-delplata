import { getEffectiveGuestCounts } from '@/lib/guest-capacity';

// Lotação de um quarto da Delplata: até 3 pagantes (adultos a partir de 12 anos e
// crianças de 6 a 11) e mais 1 criança de 0 a 5 anos, no total de 4 pessoas.
export const MAX_BOOKING_ADULTS = 3;
export const MAX_BOOKING_GUESTS = 4;

export const ROOM_CAPACITY_MESSAGE =
    'Não encontrou na busca a acomodação que procura? Fale com a gente no WhatsApp que a gente ajuda.';

/** true quando a ocupação não cabe em um quarto. Crianças sem idade informada contam só no total. */
export function exceedsRoomCapacity(input: { adults: number; children?: number; childrenAges?: ReadonlyArray<number | null> }): boolean {
    const knownAges = (input.childrenAges ?? []).filter((age): age is number => typeof age === 'number' && Number.isFinite(age));
    const counts = getEffectiveGuestCounts({ adults: input.adults, childrenAges: knownAges });
    const unknownAges = Math.max(0, (input.children ?? knownAges.length) - knownAges.length);
    return counts.effectiveGuests > MAX_BOOKING_ADULTS || counts.totalGuests + unknownAges > MAX_BOOKING_GUESTS;
}
