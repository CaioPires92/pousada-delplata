import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { updatePipelineCard } from "@/lib/crm/pipelineCards";
import { upsertReservationDraftFromMessage } from "@/lib/crm/reservationDraft";
import { classifyIntent } from "@/lib/crm/aiIntentClassifier";
import { applyPipelineAutomationOnIncomingMessage } from "./pipelineAutomation";
import { isPipelineAutomationEnabled } from "@/lib/crm/chatbotSettings";

vi.mock("@/lib/prisma", () => ({
  default: {
    pipelineCard: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crm/events", () => ({
  recordCrmEvent: vi.fn(),
}));

vi.mock("@/lib/crm/pipelineCards", () => ({
  updatePipelineCard: vi.fn(),
}));

vi.mock("@/lib/crm/reservationDraft", () => ({
  upsertReservationDraftFromMessage: vi.fn(),
}));

vi.mock("@/lib/crm/aiIntentClassifier", () => ({
  classifyIntent: vi.fn(),
}));

vi.mock("@/lib/crm/chatbotSettings", () => ({
  isPipelineAutomationEnabled: vi.fn(),
}));

describe("applyPipelineAutomationOnIncomingMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordCrmEvent).mockResolvedValue(null as any);
    vi.mocked(updatePipelineCard).mockResolvedValue({ ok: true } as any);
    vi.mocked(upsertReservationDraftFromMessage).mockResolvedValue({} as any);
    vi.mocked(classifyIntent).mockResolvedValue({
      intent: "unknown",
      confidence: 0.4,
      source: "heuristic",
    });
    vi.mocked(isPipelineAutomationEnabled).mockResolvedValue(true);
  });

  it("does nothing when pipeline automation is disabled", async () => {
    vi.mocked(isPipelineAutomationEnabled).mockResolvedValue(false);

    await applyPipelineAutomationOnIncomingMessage({
      conversationId: "conv-1",
      contactId: "contact-1",
      text: "quero reservar",
    });

    expect(prisma.pipelineCard.findFirst).not.toHaveBeenCalled();
    expect(classifyIntent).not.toHaveBeenCalled();
    expect(updatePipelineCard).not.toHaveBeenCalled();
  });

  it("moves ORCAMENTO_ENVIADO to AGUARDANDO_RESPOSTA when guest replies", async () => {
    vi.mocked(prisma.pipelineCard.findFirst).mockResolvedValue({ id: "card-1", stage: "ORCAMENTO_ENVIADO" } as any);

    await applyPipelineAutomationOnIncomingMessage({
      conversationId: "conv-1",
      contactId: "contact-1",
      text: "tenho interesse",
    });

    expect(updatePipelineCard).toHaveBeenCalledWith(
      "card-1",
      expect.objectContaining({ stage: "AGUARDANDO_RESPOSTA" })
    );
  });

  it("emits ReservationStarted and moves to RESERVA_EM_ANDAMENTO on reservation intent", async () => {
    vi.mocked(prisma.pipelineCard.findFirst).mockResolvedValue({ id: "card-1", stage: "AGUARDANDO_RESPOSTA" } as any);

    await applyPipelineAutomationOnIncomingMessage({
      conversationId: "conv-1",
      contactId: "contact-1",
      text: "quero fechar a reserva e pagar no pix",
    });

    expect(upsertReservationDraftFromMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conv-1",
      contactId: "contact-1",
    }));
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ReservationStarted" }));
    expect(updatePipelineCard).toHaveBeenCalledWith(
      "card-1",
      expect.objectContaining({ stage: "RESERVA_EM_ANDAMENTO" })
    );
  });

  it("does not let an AI shadow classification start a reservation", async () => {
    vi.mocked(prisma.pipelineCard.findFirst).mockResolvedValue({ id: "card-1", stage: "AGUARDANDO_RESPOSTA" } as any);
    vi.mocked(classifyIntent).mockResolvedValue({
      intent: "reservation",
      confidence: 0.99,
      source: "ai",
    });

    await applyPipelineAutomationOnIncomingMessage({
      conversationId: "conv-1",
      contactId: "contact-1",
      text: "talvez eu veja isso depois",
    });

    expect(upsertReservationDraftFromMessage).not.toHaveBeenCalled();
    expect(updatePipelineCard).not.toHaveBeenCalledWith(
      "card-1",
      expect.objectContaining({ stage: "RESERVA_EM_ANDAMENTO" })
    );
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "IntentClassified",
      metadata: expect.objectContaining({ mode: "shadow", actionAuthorized: false }),
    }));
  });
});
