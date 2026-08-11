import { describe, expect, it } from "vitest";

import { canTransitionPipelineStage } from "./pipelineMachine";
import { PIPELINE_STAGE_ORDER, PIPELINE_STAGES, type PipelineStage } from "./pipelineStages";

const EXPECTED_FORWARD_TRANSITIONS: Record<PipelineStage, readonly PipelineStage[]> = {
  [PIPELINE_STAGES.NOVO_LEAD]: [PIPELINE_STAGES.QUALIFICANDO, PIPELINE_STAGES.PERDIDO],
  [PIPELINE_STAGES.QUALIFICANDO]: [
    PIPELINE_STAGES.CONSULTANDO_DISPONIBILIDADE,
    PIPELINE_STAGES.ORCAMENTO_ENVIADO,
    PIPELINE_STAGES.PERDIDO,
  ],
  [PIPELINE_STAGES.CONSULTANDO_DISPONIBILIDADE]: [
    PIPELINE_STAGES.ORCAMENTO_ENVIADO,
    PIPELINE_STAGES.PERDIDO,
  ],
  [PIPELINE_STAGES.ORCAMENTO_ENVIADO]: [
    PIPELINE_STAGES.AGUARDANDO_RESPOSTA,
    PIPELINE_STAGES.RESERVA_EM_ANDAMENTO,
    PIPELINE_STAGES.PERDIDO,
  ],
  [PIPELINE_STAGES.AGUARDANDO_RESPOSTA]: [
    PIPELINE_STAGES.RESERVA_EM_ANDAMENTO,
    PIPELINE_STAGES.PERDIDO,
  ],
  [PIPELINE_STAGES.RESERVA_EM_ANDAMENTO]: [
    PIPELINE_STAGES.PAGAMENTO_PENDENTE,
    PIPELINE_STAGES.RESERVA_CONFIRMADA,
    PIPELINE_STAGES.PERDIDO,
  ],
  [PIPELINE_STAGES.PAGAMENTO_PENDENTE]: [
    PIPELINE_STAGES.RESERVA_CONFIRMADA,
    PIPELINE_STAGES.PERDIDO,
  ],
  [PIPELINE_STAGES.RESERVA_CONFIRMADA]: [
    PIPELINE_STAGES.HOSPEDADO,
    PIPELINE_STAGES.POS_VENDA,
    PIPELINE_STAGES.PERDIDO,
  ],
  [PIPELINE_STAGES.HOSPEDADO]: [PIPELINE_STAGES.POS_VENDA],
  [PIPELINE_STAGES.POS_VENDA]: [PIPELINE_STAGES.PERDIDO],
  [PIPELINE_STAGES.PERDIDO]: [],
};

const COMPLETE_TRANSITION_MATRIX = PIPELINE_STAGE_ORDER.flatMap((from) =>
  PIPELINE_STAGE_ORDER.map((to) => ({
    from,
    to,
    expected: from === to || EXPECTED_FORWARD_TRANSITIONS[from].includes(to),
  }))
);

describe("canTransitionPipelineStage", () => {
  it.each(COMPLETE_TRANSITION_MATRIX)(
    "$from -> $to: expected=$expected",
    ({ from, to, expected }) => {
      expect(canTransitionPipelineStage(from, to).ok).toBe(expected);
    }
  );

  it("normalizes legacy stages before applying the matrix", () => {
    expect(canTransitionPipelineStage("novo", "em_atendimento")).toMatchObject({
      ok: true,
      normalizedFrom: PIPELINE_STAGES.NOVO_LEAD,
      normalizedTo: PIPELINE_STAGES.QUALIFICANDO,
    });
    expect(canTransitionPipelineStage("fechado", "novo").ok).toBe(false);
  });

  it("rejects unknown stages even when both values are equal", () => {
    expect(canTransitionPipelineStage("DESCONHECIDO", "DESCONHECIDO")).toMatchObject({
      ok: false,
      message: "Estágio inválido: DESCONHECIDO",
    });
  });
});
