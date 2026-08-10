import { describe, expect, it } from "vitest";

import {
  describeCrmEventAudit,
  formatCrmEventDate,
  parseCrmEventMetadata,
} from "@/lib/crm/eventHistory";

describe("CRM event history presentation", () => {
  it("presents actor, origin and reason in Portuguese", () => {
    const metadata = parseCrmEventMetadata(JSON.stringify({
      actorType: "human",
      actorId: "recepcao-1",
      origin: "admin_ui",
      reason: "Reserva confirmada por telefone",
    }));

    expect(describeCrmEventAudit(metadata)).toEqual({
      actorType: "human",
      actorId: "recepcao-1",
      actorLabel: "Atendimento humano (recepcao-1)",
      origin: "admin_ui",
      originLabel: "Painel administrativo",
      reason: "Reserva confirmada por telefone",
    });
  });

  it("handles legacy or malformed metadata without breaking the history", () => {
    expect(parseCrmEventMetadata("not-json")).toBeNull();
    expect(describeCrmEventAudit(null)).toMatchObject({
      actorLabel: "Responsável não informado",
      originLabel: "Origem não informada",
      reason: null,
    });
  });

  it("always displays event time in Sao Paulo", () => {
    expect(formatCrmEventDate("2026-08-10T17:30:00.000Z")).toContain("14:30:00");
  });
});
