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
  "Apartamento Térreo|IMG_0130": "Sem janela (a maioria dos térreos)",
  "Apartamento Térreo|IMG_0127": "Sem janela (a maioria dos térreos)",
  "Apartamento Térreo|IMG_0128": "Sem janela (a maioria dos térreos)",
  "Apartamento Térreo|IMG_0131": "Sem janela (a maioria dos térreos)",
  "Apartamento Térreo|IMG_0133": "Sem janela (a maioria dos térreos)",
  "Apartamento Térreo|IMG_0135": "Banheiro",
  "Apartamento Térreo|DSC_0001": "Com janela (poucas unidades)",
  "Apartamento Térreo|DSC_0005": "Com janela (poucas unidades)",
  "Apartamento Anexo|IMG_0046": "Banheiro",
  "Apartamento Anexo|IMG_0069": "Fachada do anexo",
  "Apartamento Anexo|IMG_0096": "Varanda e vista",
  "Chalé|IMG_0120": "Banheiro",
  "Chalé|IMG_0122": "Banheiro",
};

/** Aviso curto abaixo da galeria, quando a foto sozinha pode gerar expectativa errada. */
const NOTES: Record<string, string> = {
  "Apartamento Térreo":
    "A maioria dos apartamentos térreos não tem janela; poucos têm. A unidade é definida conforme a disponibilidade, e você pode pedir preferência pelo WhatsApp: confirmamos se for possível.",
};

export function getRoomGalleryNote(roomName: string): string | null {
  return NOTES[roomName] ?? null;
}

function photoKey(src: string) {
  const file = src.split("?")[0].split("/").pop() ?? "";
  return file.replace(/-\d+\.webp$/i, "").replace(/\.[a-z0-9]+$/i, "");
}

export function buildRoomGalleryPhotos(roomName: string, urls: readonly string[]): GalleryPhoto[] {
  const captions = urls.map((src) => LABELS[`${roomName}|${photoKey(src)}`] ?? roomName);
  const totalByCaption = new Map<string, number>();
  for (const caption of captions) totalByCaption.set(caption, (totalByCaption.get(caption) ?? 0) + 1);
  const countByCaption = new Map<string, number>();
  return urls.map((src, index) => {
    const caption = captions[index];
    const next = (countByCaption.get(caption) ?? 0) + 1;
    countByCaption.set(caption, next);
    // O título do grupo leva o texto completo; cada item usa o nome curto, sem o que vem entre parênteses.
    const short = caption.replace(/\s*\(.*\)$/, "");
    // "foto 1 de 2" deixa claro que é a contagem de fotos, e não o número de um apartamento.
    const total = totalByCaption.get(caption) ?? 1;
    return { src, alt: total > 1 ? `${short} (foto ${next} de ${total})` : short, caption };
  });
}
