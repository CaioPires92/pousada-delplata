import { describe, expect, it } from "vitest";

import { resolveLossReasonInput } from "@/lib/crm/pipelineCards";

describe("pipeline card loss reason compatibility", () => {
  it("uses lossReason as the canonical field", () => {
    expect(resolveLossReasonInput({ lossReason: "Sem retorno" })).toEqual({
      ok: true,
      provided: true,
      value: "Sem retorno",
    });
  });

  it("accepts lostReason temporarily as a legacy alias", () => {
    expect(resolveLossReasonInput({ lostReason: "Preço" })).toEqual({
      ok: true,
      provided: true,
      value: "Preço",
    });
  });

  it("rejects conflicting aliases instead of silently choosing one", () => {
    expect(resolveLossReasonInput({ lossReason: "Preço", lostReason: "Datas" })).toEqual({
      ok: false,
      error: "conflicting_loss_reason",
    });
  });

  it("does not mutate the field when neither alias was provided", () => {
    expect(resolveLossReasonInput({})).toEqual({ ok: true, provided: false });
  });
});
