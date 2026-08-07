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

  it("understands a shared-month range joined with e", () => {
    expect(parseCrmIntent("Dia 12 e 13 de setembro", referenceDate)).toMatchObject({
      checkin: "2026-09-12",
      checkout: "2026-09-13",
      validationIssues: [],
    });
  });

  it("rejects a stated number of nights that conflicts with the date range", () => {
    expect(parseCrmIntent(
      "Quero 3 diárias de 18/09/2026 a 20/09/2026 para 2 adultos",
      referenceDate
    )).toMatchObject({
      intent: "quote",
      checkin: "2026-09-18",
      checkout: undefined,
      statedNights: 3,
      missingFields: ["checkout"],
      validationIssues: [{
        field: "dateRange",
        code: "nights_mismatch",
        statedNights: 3,
        calculatedNights: 2,
      }],
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

  it("requires every child age and understands a natural age list", () => {
    expect(parseCrmIntent(
      "Orçamento 20/07 a 22/07 para 2 adultos e 2 crianças",
      referenceDate
    )).toMatchObject({
      children: 2,
      childrenAges: [],
      confidence: "medium",
      validationIssues: [{ field: "children", code: "missing_children_ages" }],
    });

    expect(parseCrmIntent("As idades são 5 e 8 anos", referenceDate)).toMatchObject({
      children: 2,
      childrenAges: [5, 8],
      validationIssues: [],
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

  it("rejects explicit dates in the past instead of silently quoting them", () => {
    expect(parseCrmIntent("Cotacao de 01/01/2026 a 01/01/23 para 2 adultos", referenceDate)).toMatchObject({
      intent: "quote",
      checkin: undefined,
      checkout: undefined,
      missingFields: ["checkin", "checkout"],
      validationIssues: [
        { field: "checkin", code: "past_date" },
        { field: "checkout", code: "past_date" },
      ],
    });
  });

  it("rejects impossible dates and checkout not later than checkin", () => {
    expect(parseCrmIntent("Valor de 31/02/2027 a 02/03/2027 para 2 adultos", referenceDate).validationIssues)
      .toContainEqual({ field: "checkin", code: "invalid_date" });
    expect(parseCrmIntent("Valor de 17/06/2026 a 15/06/2026 para 2 adultos", referenceDate)).toMatchObject({
      checkin: "2026-06-17",
      checkout: undefined,
      validationIssues: [{ field: "dateRange", code: "invalid_date_range" }],
    });
  });

  it("rejects excessive stay duration and guest counts", () => {
    expect(parseCrmIntent("Valor de 15/06/2026 a 20/09/2026 para 31 adultos", referenceDate)).toMatchObject({
      checkout: undefined,
      adults: undefined,
      missingFields: ["checkout", "adults"],
      validationIssues: [
        { field: "dateRange", code: "stay_too_long" },
        { field: "adults", code: "invalid_guest_count" },
        { field: "guests", code: "too_many_guests" },
      ],
    });
  });
});
