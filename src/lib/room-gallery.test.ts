import { describe, expect, it } from "vitest";

import { buildRoomGalleryPhotos, getRoomGalleryNote } from "./room-gallery";
import { getLocalRoomPhotos } from "./room-photos";

describe("legendas das fotos dos quartos", () => {
  it("usa o nome do quarto e numera as fotos sem particularidade", () => {
    const photos = buildRoomGalleryPhotos("Chalé", ["/x/IMG_0109-1200.webp", "/x/IMG_0110-1200.webp"]);
    expect(photos.map((p) => p.caption)).toEqual(["Chalé", "Chalé"]);
    expect(photos.map((p) => p.alt)).toEqual(["Chalé (foto 1 de 2)", "Chalé (foto 2 de 2)"]);
  });

  it("legenda as particularidades e numera dentro de cada legenda", () => {
    const photos = buildRoomGalleryPhotos("Apartamento Superior", [
      "/s/DSC_0039-1200.webp",
      "/s/DSC_0045-1200.webp",
      "/s/DSC_0046-1200.webp",
    ]);
    expect(photos.map((p) => p.alt)).toEqual(["Com beliche (foto 1 de 2)", "Com beliche (foto 2 de 2)", "Sem beliche"]);
  });

  it("fotos locais do Térreo: sem janela e com janela têm legendas diferentes", () => {
    const captions = buildRoomGalleryPhotos("Apartamento Térreo", getLocalRoomPhotos("Apartamento Térreo") ?? []).map((p) => p.caption);
    expect(captions).toContain("Sem janela (a maioria dos térreos)");
    expect(captions).toContain("Com janela (poucas unidades)");
    const alts = buildRoomGalleryPhotos("Apartamento Térreo", getLocalRoomPhotos("Apartamento Térreo") ?? []).map((p) => p.alt);
    expect(alts).toContain("Sem janela (foto 1 de 5)");
    expect(alts).toContain("Com janela (foto 2 de 2)");
    expect(getRoomGalleryNote("Apartamento Térreo")).toContain("A maioria dos apartamentos térreos não tem janela");
  });

  it("fotos iguais seguidas ficam agrupadas (a janela de fotos agrupa por legenda vizinha)", () => {
    const photos = buildRoomGalleryPhotos("Apartamento Superior", getLocalRoomPhotos("Apartamento Superior") ?? []);
    const seen: string[] = [];
    for (const p of photos) if (seen[seen.length - 1] !== p.caption) seen.push(p.caption);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
