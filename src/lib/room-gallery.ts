import type { GalleryPhoto } from "@/components/home-novo/PhotoLightbox";

// Legendas das fotos dos quartos. A janela de fotos agrupa as fotos seguidas com a mesma legenda e lista cada uma
// como "(foto 1)", "(foto 2)"; foto sem nada de especial usa o nome do quarto. Só legende o que se vê na foto.
// Chave: "Nome do quarto|arquivo sem tamanho nem extensão".
const LABELS: Record<string, string> = {
  "Apartamento Superior|DSC_0039": "Com beliche",
  "Apartamento Superior|DSC_0045": "Com beliche",
  "Apartamento Superior|DSC_0050": "Com beliche",
  "Apartamento Superior|DSC_0046": "Sem beliche",
  "Apartamento Superior|DSC_0058": "Sem beliche, com a decoração romântica opcional",
  "Apartamento Superior|DSC_0072": "Banheiro",
  "Apartamento Superior|DSC_0041": "Corredor dos apartamentos superiores",
  "Apartamento Superior|DSC_0076": "Corredor dos apartamentos superiores",
  "Apartamento Térreo|IMG_0130": "Sem janela (6 dos 8 térreos)",
  "Apartamento Térreo|IMG_0127": "Sem janela (6 dos 8 térreos)",
  "Apartamento Térreo|IMG_0128": "Sem janela (6 dos 8 térreos)",
  "Apartamento Térreo|IMG_0131": "Sem janela (6 dos 8 térreos)",
  "Apartamento Térreo|IMG_0133": "Sem janela (6 dos 8 térreos)",
  "Apartamento Térreo|IMG_0135": "Banheiro",
  "Apartamento Térreo|DSC_0001": "Com janela (só 2 dos 8 térreos)",
  "Apartamento Térreo|DSC_0005": "Com janela (só 2 dos 8 térreos)",
  "Apartamento Anexo|IMG_0046": "Banheiro",
  "Apartamento Anexo|IMG_0069": "Fachada do anexo",
  "Apartamento Anexo|IMG_0096": "Varanda e vista",
  "Chalé|IMG_0120": "Banheiro",
  "Chalé|IMG_0122": "Banheiro",
};

/** Aviso curto abaixo da galeria, quando a foto sozinha pode gerar expectativa errada. */
const NOTES: Record<string, string> = {
  "Apartamento Térreo":
    "Dos 8 apartamentos térreos, 6 não têm janela e 2 têm. A unidade é definida conforme a disponibilidade; você pode pedir preferência pelo WhatsApp e confirmamos se for possível.",
};

export function getRoomGalleryNote(roomName: string): string | null {
  return NOTES[roomName] ?? null;
}

function photoKey(src: string) {
  const file = src.split("?")[0].split("/").pop() ?? "";
  return file.replace(/-\d+\.webp$/i, "").replace(/\.[a-z0-9]+$/i, "");
}

export function buildRoomGalleryPhotos(roomName: string, urls: readonly string[]): GalleryPhoto[] {
  const countByCaption = new Map<string, number>();
  return urls.map((src) => {
    const caption = LABELS[`${roomName}|${photoKey(src)}`] ?? roomName;
    const next = (countByCaption.get(caption) ?? 0) + 1;
    countByCaption.set(caption, next);
    // O título do grupo leva o texto completo; cada item usa o nome curto, sem o que vem entre parênteses.
    const short = caption.replace(/\s*\(.*\)$/, "");
    return { src, alt: `${short} (foto ${next})`, caption };
  });
}
