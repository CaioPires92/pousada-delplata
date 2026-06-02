import { PIPELINE_STAGES, type PipelineStage, normalizePipelineStage } from "@/lib/crm/pipelineStages";

const ALLOWED_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
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
  [PIPELINE_STAGES.RESERVA_CONFIRMADA]: [PIPELINE_STAGES.HOSPEDADO, PIPELINE_STAGES.PERDIDO],
  [PIPELINE_STAGES.HOSPEDADO]: [PIPELINE_STAGES.POS_VENDA],
  [PIPELINE_STAGES.POS_VENDA]: [PIPELINE_STAGES.PERDIDO],
  [PIPELINE_STAGES.PERDIDO]: [],
};

export function canTransitionPipelineStage(from: string, to: string) {
  const normalizedFrom = normalizePipelineStage(from);
  const normalizedTo = normalizePipelineStage(to);

  if (normalizedFrom === normalizedTo) {
    return { ok: true as const, normalizedFrom, normalizedTo };
  }

  const allowed = ALLOWED_TRANSITIONS[normalizedFrom] ?? [];
  if (allowed.includes(normalizedTo)) {
    return { ok: true as const, normalizedFrom, normalizedTo };
  }

  return {
    ok: false as const,
    normalizedFrom,
    normalizedTo,
    message: `Transição inválida: ${normalizedFrom} -> ${normalizedTo}`,
  };
}
