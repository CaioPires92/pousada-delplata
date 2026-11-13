// Política de pets da Pousada Delplata: só pets de pequeno porte, com taxa,
// nos apartamentos térreos, chalés e anexos (o Apartamento Superior não aceita).
const PET_FRIENDLY_ROOM_KEYWORDS = ['terreo', 'chale', 'anexo'];

export const PET_POLICY_NOTICE =
    'Aceitamos pets de pequeno porte, com taxa, nos apartamentos térreos, chalés e anexos.';

function normalize(name: string) {
    return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function roomAcceptsPets(roomName: string | null | undefined) {
    const normalized = normalize(String(roomName || ''));
    return PET_FRIENDLY_ROOM_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
