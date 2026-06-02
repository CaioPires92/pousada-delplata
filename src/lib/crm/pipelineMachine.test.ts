import { describe, expect, it } from "vitest";

import { canTransitionPipelineStage } from "./pipelineMachine";

describe("canTransitionPipelineStage", () => {
  it("accepts valid forward transition", () => {
    const result = canTransitionPipelineStage("NOVO_LEAD", "QUALIFICANDO");
    expect(result.ok).toBe(true);
  });

  it("rejects invalid jump transition", () => {
    const result = canTransitionPipelineStage("NOVO_LEAD", "PAGAMENTO_PENDENTE");
    expect(result.ok).toBe(false);
  });

  it("accepts no-op transitions", () => {
    const result = canTransitionPipelineStage("ORCAMENTO_ENVIADO", "ORCAMENTO_ENVIADO");
    expect(result.ok).toBe(true);
  });
});
