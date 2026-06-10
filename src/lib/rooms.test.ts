import { describe, expect, it } from "vitest";

import { buildWingSummaries, getRoomAmenitiesList, isAnnexWingRoom, isMainWingRoom } from "./rooms";

describe("rooms helpers", () => {
  it("normaliza amenities a partir do cadastro", () => {
    expect(getRoomAmenitiesList(" Ar-condicionado, WiFi , Smart TV ")).toEqual([
      "Ar-condicionado",
      "WiFi",
      "Smart TV",
    ]);
  });

  it("classifica quartos por ala", () => {
    expect(isMainWingRoom("Apartamento Térreo")).toBe(true);
    expect(isMainWingRoom("Apartamento Superior")).toBe(true);
    expect(isAnnexWingRoom("Apartamento Anexo")).toBe(true);
    expect(isAnnexWingRoom("Chalé")).toBe(true);
  });

  it("gera highlights das alas com base no cadastro real", () => {
    expect(
      buildWingSummaries([
        { name: "Apartamento Térreo", maxGuests: 4 },
        { name: "Apartamento Superior", maxGuests: 4 },
        { name: "Apartamento Anexo", maxGuests: 3 },
        { name: "Chalé", maxGuests: 4 },
      ])
    ).toEqual([
      {
        id: "ala-principal",
        title: "Ala Principal",
        description: "Praticidade e ótimo custo-benefício. Perfeito para famílias e casais.",
        highlights: ["Apartamentos térreo e superior", "Até 4 hóspedes"],
      },
      {
        id: "ala-anexo",
        title: "Ala Chalés e Anexos",
        description: "Mais privacidade em meio à natureza. Espaço ideal para relaxar.",
        highlights: ["Chalés e apartamentos anexos", "Até 4 hóspedes"],
      },
    ]);
  });
});
