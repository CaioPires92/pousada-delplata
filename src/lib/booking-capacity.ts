import { getEffectiveGuestCounts } from '@/lib/guest-capacity';

// Lotação de um quarto da Delplata. Pagantes são adultos (a partir de 12 anos) e crianças
// de 6 a 11. Até 3 pagantes a reserva usa o quarto STD (capacidade 3); com 4 pagantes usa o
// estoque de 4 hóspedes (subinventário do STD, ver requiresFourGuestInventory). Em qualquer
// um deles cabe no máximo 1 pessoa além da capacidade, e ela tem de ser criança de 0 a 5 anos.
export const MAX_BOOKING_ADULTS = 4;
export const MAX_BOOKING_GUESTS = 5;
export const STANDARD_ROOM_CAPACITY = 3;

/** Aviso exibido quando a criança de 0 a 5 anos é a pessoa a mais além da capacidade do quarto. */
export const EXTRA_CHILD_NOTICE = 'Criança de até 5 anos é cortesia, sem cama extra.';

/** Capacidade do quarto que a ocupação usa: STD até 3 pagantes, quarto de 4 com 4 pagantes. */
export function unitCapacityFor(payingGuests: number, room?: { capacity?: number | null; maxGuests?: number | null }): number {
    const standard = Number(room?.capacity) > 0 ? Number(room?.capacity) : STANDARD_ROOM_CAPACITY;
    const max = Number(room?.maxGuests) > 0 ? Number(room?.maxGuests) : MAX_BOOKING_ADULTS;
    return payingGuests > standard ? Math.max(standard, max) : standard;
}

/** true quando a ocupação passa a capacidade do quarto em 1 criança de 0 a 5 anos. */
export function needsExtraChildNotice(
    input: { adults: number; childrenAges?: ReadonlyArray<number | null> },
    room?: { capacity?: number | null; maxGuests?: number | null },
): boolean {
    const knownAges = (input.childrenAges ?? []).filter((age): age is number => typeof age === 'number' && Number.isFinite(age));
    const counts = getEffectiveGuestCounts({ adults: input.adults, childrenAges: knownAges });
    if (counts.freeChildren === 0) return false;
    return counts.totalGuests > unitCapacityFor(counts.effectiveGuests, room);
}

export const ROOM_CAPACITY_MESSAGE =
    'Não encontrou na busca a acomodação que procura? Fale com a gente no WhatsApp.';

/** true quando a ocupação não cabe em um quarto. Crianças sem idade informada contam só no total. */
export function exceedsRoomCapacity(input: { adults: number; children?: number; childrenAges?: ReadonlyArray<number | null> }): boolean {
    const knownAges = (input.childrenAges ?? []).filter((age): age is number => typeof age === 'number' && Number.isFinite(age));
    const counts = getEffectiveGuestCounts({ adults: input.adults, childrenAges: knownAges });
    const unknownAges = Math.max(0, (input.children ?? knownAges.length) - knownAges.length);
    if (counts.effectiveGuests > MAX_BOOKING_ADULTS) return true;
    return counts.totalGuests + unknownAges > unitCapacityFor(counts.effectiveGuests) + 1;
}
