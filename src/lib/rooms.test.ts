import { describe, expect, it } from "vitest";

import { buildWingSummaries, getRoomAmenitiesList, isAnnexWingRoom, isMainWingRoom, roomDisplayRank, sortRoomsForDisplay } from "./rooms";

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
        description: "Apartamentos localizados na ala principal da pousada.",
        highlights: ["Apartamentos térreo e superior", "Até 4 hóspedes"],
      },
      {
        id: "ala-anexo",
        title: "Ala Chalés e Anexos",
        description: "Chalés e apartamentos localizados na ala de anexos.",
        highlights: ["Chalés e apartamentos anexos", "Até 4 hóspedes"],
      },
    ]);
  });
});

describe("ordem de exibição das acomodações", () => {
  it("ordena Térreo, Superior, Chalé, Anexo, não importa a ordem de entrada (preço, banco etc.)", () => {
    const entrada = [
      { name: "Apartamento Anexo" },
      { name: "Chalé" },
      { name: "Apartamento Superior" },
      { name: "Apartamento Térreo" },
    ];
    expect(sortRoomsForDisplay(entrada).map((room) => room.name)).toEqual([
      "Apartamento Térreo",
      "Apartamento Superior",
      "Chalé",
      "Apartamento Anexo",
    ]);
    expect(entrada[0].name).toBe("Apartamento Anexo"); // não altera a lista original
  });

  it("reconhece nomes sem acento e deixa nomes desconhecidos no fim, na ordem original", () => {
    expect(roomDisplayRank("Apartamento Terreo")).toBe(0);
    expect(roomDisplayRank("CHALE")).toBe(2);
    const resultado = sortRoomsForDisplay([{ name: "Suíte X" }, { name: "Chalé" }, { name: "Suíte Y" }, { name: "Apartamento Térreo" }]);
    expect(resultado.map((room) => room.name)).toEqual(["Apartamento Térreo", "Chalé", "Suíte X", "Suíte Y"]);
  });
});
