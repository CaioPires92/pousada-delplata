import { describe, expect, it } from "vitest";

import { parseCrmIntent } from "./intentParser";

const referenceDate = new Date("2026-05-12T12:00:00.000Z");

describe("parseCrmIntent", () => {
  it("extracts quote intent, dates and adults from a direct pricing message", () => {
    expect(parseCrmIntent("Qual o valor da diaria de 15/06 a 17/06 para 2 adultos?", referenceDate)).toMatchObject({
      intent: "quote",
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 2,
      missingFields: [],
      confidence: "high",
    });
  });

  it("understands a range with shared month written in natural language", () => {
    expect(parseCrmIntent("Tem vaga de 15 a 17 de junho para casal?", referenceDate)).toMatchObject({
      intent: "quote",
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 2,
      missingFields: [],
    });
  });

  it("returns partial fields when the guest asks price without dates", () => {
    expect(parseCrmIntent("Quanto fica para 3 pessoas?", referenceDate)).toMatchObject({
      intent: "quote",
      adults: 3,
      missingFields: ["checkin", "checkout"],
      confidence: "medium",
    });
  });

  it("extracts children count and ages when present", () => {
    expect(parseCrmIntent("Orcamento 20/07 a 22/07, 2 adultos e 1 crianca de 7 anos", referenceDate)).toMatchObject({
      intent: "quote",
      checkin: "2026-07-20",
      checkout: "2026-07-22",
      adults: 2,
      children: 1,
      childrenAges: [7],
      missingFields: [],
    });
  });

  it("rolls month-only past dates to the next year", () => {
    expect(parseCrmIntent("Valor de 10/01 a 12/01 para 2 adultos", referenceDate)).toMatchObject({
      checkin: "2027-01-10",
      checkout: "2027-01-12",
    });
  });

  it("detects reservation intent without forcing quote fields", () => {
    expect(parseCrmIntent("Gostei, quero fechar a reserva e pagar no pix", referenceDate)).toMatchObject({
      intent: "reservation",
      missingFields: [],
      confidence: "medium",
    });
  });

  it("detects operational amenity intents", () => {
    expect(parseCrmIntent("Aceita pet e tem estacionamento?", referenceDate)).toMatchObject({
      intent: "pet",
      missingFields: [],
    });
  });

  it("stays unknown for unrelated messages", () => {
    expect(parseCrmIntent("Bom dia, tudo bem?", referenceDate)).toMatchObject({
      intent: "unknown",
      missingFields: [],
      confidence: "low",
    });
  });
});
