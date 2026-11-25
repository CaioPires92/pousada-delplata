// Decoração romântica: item opcional, combinado com a pousada (não é cobrado pelo motor de reservas).
// O valor e o que está incluso foram informados pelo dono em 25/11/2026; mudou algo? Altere só aqui.

import type { GalleryPhoto } from "@/components/home-novo/PhotoLightbox";

export const ROMANTIC_DECOR_PRICE_LABEL = "R$ 80";

export const ROMANTIC_DECOR_ITEMS = [
  "Pétalas de rosas artificiais sobre a cama",
  "Toalhas dobradas em forma de cisne",
  "Espumante",
  "Caixa de bombom",
] as const;

// As fotos são do apartamento Superior, mas a decoração pode ser feita em qualquer acomodação.
const P = "/fotos/ala-principal/apartamentos/superior/";
export const ROMANTIC_DECOR_PHOTOS: readonly GalleryPhoto[] = [
  { src: `${P}DSC_0058-1920.webp`, alt: "Cama com pétalas de rosas e toalhas em forma de cisne", caption: "Decoração romântica (foto no apartamento Superior)" },
  { src: `${P}DSC_0043-1920.webp`, alt: "Cama de casal decorada com pétalas de rosas", caption: "Decoração romântica (foto no apartamento Superior)" },
  { src: `${P}DSC_0051-1920.webp`, alt: "Quarto com cama decorada com pétalas e toalhas em forma de cisne", caption: "Decoração romântica (foto no apartamento Superior)" },
  { src: `${P}DSC_0065-1920.webp`, alt: "Cama com pétalas de rosas vista de cima", caption: "Decoração romântica (foto no apartamento Superior)" },
  { src: `${P}DSC_0069-1920.webp`, alt: "Detalhe das pétalas sobre a cama", caption: "Decoração romântica: detalhe" },
];

const PHONE = "5519999654866";

/** Link do WhatsApp já com o pedido da decoração (e o quarto, quando a pessoa está vendo um). */
export function buildRomanticDecorWhatsAppUrl(roomName?: string | null) {
  const room = roomName ? ` no ${roomName}` : "";
  const text = `Olá! Quero pedir a decoração romântica (${ROMANTIC_DECOR_PRICE_LABEL})${room}. Pode me ajudar?`;
  return `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
}
