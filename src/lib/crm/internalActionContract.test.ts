import { describe, expect, it } from "vitest";

import {
  INTERNAL_ACTION_ALLOWLIST,
  parseInternalAction,
  parseInternalActionResult,
} from "@/lib/crm/internalActionContract";

describe("internalActionContract", () => {
  it("mantém uma allowlist explícita das ferramentas internas", () => {
    expect(INTERNAL_ACTION_ALLOWLIST).toEqual([
      "MOVE_PIPELINE_CARD",
      "SEND_WHATSAPP_MESSAGE",
      "PAUSE_AUTOMATION",
      "SET_CONVERSATION_AUTOMATION_PAUSED",
      "UPDATE_LEAD_FIELDS",
      "ADD_CARD_NOTE",
      "SET_CARD_TAGS",
      "CREATE_FOLLOW_UP_TASK",
      "MARK_QUOTE_SENT",
      "MARK_RESERVATION_INTENT",
      "MARK_PAYMENT_PENDING",
      "MARK_RESERVATION_CONFIRMED",
      "REGISTER_UPSELL_OFFER",
      "REGISTER_UPSELL_ACCEPTED",
      "REGISTER_UPSELL_REJECTED",
    ]);
  });

  it("aceita e normaliza uma ação permitida", () => {
    expect(parseInternalAction({
      action: "SEND_WHATSAPP_MESSAGE",
      payload: { conversationId: " conversation-id ", text: " Olá! " },
    })).toEqual({
      success: true,
      data: {
        action: "SEND_WHATSAPP_MESSAGE",
        payload: { conversationId: "conversation-id", text: "Olá!" },
      },
    });
  });

  it("rejeita ação fora da allowlist", () => {
    expect(parseInternalAction({
      action: "DELETE_ALL_CONVERSATIONS",
      payload: {},
    })).toEqual({ success: false, reason: "unsupported_action" });
  });

  it("rejeita campos extras no envelope e no payload", () => {
    expect(parseInternalAction({
      action: "SEND_WHATSAPP_MESSAGE",
      payload: { conversationId: "id", text: "oi" },
      bypassApproval: true,
    })).toEqual({ success: false, reason: "invalid_envelope" });

    expect(parseInternalAction({
      action: "SEND_WHATSAPP_MESSAGE",
      payload: { conversationId: "id", text: "oi", admin: true },
    })).toEqual({ success: false, reason: "invalid_payload" });
  });

  it("rejeita estágio, pausa e atualização comercial inválidos", () => {
    expect(parseInternalAction({
      action: "MOVE_PIPELINE_CARD",
      payload: { pipelineCardId: "id", toStage: "QUALQUER_COISA" },
    })).toEqual({ success: false, reason: "invalid_payload" });

    expect(parseInternalAction({
      action: "PAUSE_AUTOMATION",
      payload: { conversationId: "id", minutes: 10000 },
    })).toEqual({ success: false, reason: "invalid_payload" });

    expect(parseInternalAction({
      action: "UPDATE_LEAD_FIELDS",
      payload: { pipelineCardId: "id" },
    })).toEqual({ success: false, reason: "invalid_payload" });
  });

  it("valida também a saída de cada ferramenta", () => {
    expect(parseInternalActionResult("MOVE_PIPELINE_CARD", {
      pipelineCardId: "id",
      stage: "QUALIFICANDO",
      stageChanged: true,
    })).toEqual({ pipelineCardId: "id", stage: "QUALIFICANDO", stageChanged: true });

    expect(() => parseInternalActionResult("MOVE_PIPELINE_CARD", {
      pipelineCardId: "id",
      stage: "INVALIDO",
      stageChanged: true,
    })).toThrow();
  });
});
