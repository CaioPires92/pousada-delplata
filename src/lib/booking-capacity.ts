import { getEffectiveGuestCounts } from '@/lib/guest-capacity';

// Lotação de um quarto da Delplata: até 4 pagantes (adultos a partir de 12 anos e crianças
// de 6 a 11) e, além deles, 1 criança de 0 a 5 anos (cortesia, sem cama extra): no máximo
// 5 pessoas. Com 4 pagantes a reserva usa o estoque de 4 hóspedes do quarto (subinventário
// do STD, ver requiresFourGuestInventory); quartos sem esse estoque não aparecem.
export const MAX_BOOKING_ADULTS = 4;
export const MAX_BOOKING_GUESTS = 5;

/** Aviso exibido quando há criança de 0 a 5 anos na ocupação. */
export const FREE_CHILD_NOTICE = 'Criança de 0 a 5 anos é cortesia e não tem cama extra: dorme com os responsáveis.';

export function hasFreeChild(childrenAges: ReadonlyArray<number | null> | undefined): boolean {
    return (childrenAges ?? []).some((age) => typeof age === 'number' && age >= 0 && age <= 5);
}

export const ROOM_CAPACITY_MESSAGE =
    'Não encontrou na busca a acomodação que procura? Fale com a gente no WhatsApp.';

/** true quando a ocupação não cabe em um quarto. Crianças sem idade informada contam só no total. */
export function exceedsRoomCapacity(input: { adults: number; children?: number; childrenAges?: ReadonlyArray<number | null> }): boolean {
    const knownAges = (input.childrenAges ?? []).filter((age): age is number => typeof age === 'number' && Number.isFinite(age));
    const counts = getEffectiveGuestCounts({ adults: input.adults, childrenAges: knownAges });
    const unknownAges = Math.max(0, (input.children ?? knownAges.length) - knownAges.length);
    return counts.effectiveGuests > MAX_BOOKING_ADULTS || counts.totalGuests + unknownAges > MAX_BOOKING_GUESTS;
}
