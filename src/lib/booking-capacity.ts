import { getEffectiveGuestCounts } from '@/lib/guest-capacity';

// Lotação de um quarto da Delplata: até 4 pessoas. Pagantes são adultos (a partir de 12 anos)
// e crianças de 6 a 11. Com 4 pagantes a reserva usa o estoque de 4 hóspedes do quarto
// (subinventário do STD, ver requiresFourGuestInventory); quartos sem esse estoque não aparecem.
export const MAX_BOOKING_ADULTS = 4;
export const MAX_BOOKING_GUESTS = 4;

export const ROOM_CAPACITY_MESSAGE =
    'Não encontrou na busca a acomodação que procura? Fale com a gente no WhatsApp.';

/** true quando a ocupação não cabe em um quarto. Crianças sem idade informada contam só no total. */
export function exceedsRoomCapacity(input: { adults: number; children?: number; childrenAges?: ReadonlyArray<number | null> }): boolean {
    const knownAges = (input.childrenAges ?? []).filter((age): age is number => typeof age === 'number' && Number.isFinite(age));
    const counts = getEffectiveGuestCounts({ adults: input.adults, childrenAges: knownAges });
    const unknownAges = Math.max(0, (input.children ?? knownAges.length) - knownAges.length);
    return counts.effectiveGuests > MAX_BOOKING_ADULTS || counts.totalGuests + unknownAges > MAX_BOOKING_GUESTS;
}
