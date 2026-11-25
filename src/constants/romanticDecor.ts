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
  { src: `${P}IMG_2180-1920.webp`, alt: "Cama com pétalas de rosas, toalhas em forma de cisne e espumante no balde de gelo", caption: "Decoração romântica (foto no apartamento Superior)" },
  { src: `${P}IMG_2185-1920.webp`, alt: "Quarto com a cama decorada com pétalas, cisnes de toalha e espumante", caption: "Decoração romântica (foto no apartamento Superior)" },
  { src: `${P}IMG_2188-1920.webp`, alt: "Cama decorada com pétalas em formato de coração, espumante e laço de toalha", caption: "Decoração romântica (foto no apartamento Superior)" },
  { src: `${P}IMG_2181-1920.webp`, alt: "Espumante no balde de gelo sobre a cama decorada com pétalas", caption: "Decoração romântica: espumante" },
  { src: `${P}IMG_2187-1920.webp`, alt: "Toalhas em forma de cisne formando um coração, com pétalas", caption: "Decoração romântica: toalhas em forma de cisne" },
];

const PHONE = "5519999654866";

/** Link do WhatsApp já com o pedido da decoração (e o quarto, quando a pessoa está vendo um). */
export function buildRomanticDecorWhatsAppUrl(roomName?: string | null) {
  const room = roomName ? ` no ${roomName}` : "";
  const text = `Olá! Quero pedir a decoração romântica (${ROMANTIC_DECOR_PRICE_LABEL})${room}. Pode me ajudar?`;
  return `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
}
