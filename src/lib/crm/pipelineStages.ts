export const PIPELINE_STAGES = {
  NOVO_LEAD: "NOVO_LEAD",
  QUALIFICANDO: "QUALIFICANDO",
  CONSULTANDO_DISPONIBILIDADE: "CONSULTANDO_DISPONIBILIDADE",
  ORCAMENTO_ENVIADO: "ORCAMENTO_ENVIADO",
  AGUARDANDO_RESPOSTA: "AGUARDANDO_RESPOSTA",
  RESERVA_EM_ANDAMENTO: "RESERVA_EM_ANDAMENTO",
  PAGAMENTO_PENDENTE: "PAGAMENTO_PENDENTE",
  RESERVA_CONFIRMADA: "RESERVA_CONFIRMADA",
  HOSPEDADO: "HOSPEDADO",
  POS_VENDA: "POS_VENDA",
  PERDIDO: "PERDIDO",
} as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[keyof typeof PIPELINE_STAGES];

export const PIPELINE_STAGE_ORDER: PipelineStage[] = [
  PIPELINE_STAGES.NOVO_LEAD,
  PIPELINE_STAGES.QUALIFICANDO,
  PIPELINE_STAGES.CONSULTANDO_DISPONIBILIDADE,
  PIPELINE_STAGES.ORCAMENTO_ENVIADO,
  PIPELINE_STAGES.AGUARDANDO_RESPOSTA,
  PIPELINE_STAGES.RESERVA_EM_ANDAMENTO,
  PIPELINE_STAGES.PAGAMENTO_PENDENTE,
  PIPELINE_STAGES.RESERVA_CONFIRMADA,
  PIPELINE_STAGES.HOSPEDADO,
  PIPELINE_STAGES.POS_VENDA,
  PIPELINE_STAGES.PERDIDO,
];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  [PIPELINE_STAGES.NOVO_LEAD]: "Novo lead",
  [PIPELINE_STAGES.QUALIFICANDO]: "Qualificando",
  [PIPELINE_STAGES.CONSULTANDO_DISPONIBILIDADE]: "Consultando disponibilidade",
  [PIPELINE_STAGES.ORCAMENTO_ENVIADO]: "Orcamento enviado",
  [PIPELINE_STAGES.AGUARDANDO_RESPOSTA]: "Aguardando resposta",
  [PIPELINE_STAGES.RESERVA_EM_ANDAMENTO]: "Reserva em andamento",
  [PIPELINE_STAGES.PAGAMENTO_PENDENTE]: "Pagamento pendente",
  [PIPELINE_STAGES.RESERVA_CONFIRMADA]: "Reserva confirmada",
  [PIPELINE_STAGES.HOSPEDADO]: "Hospedado",
  [PIPELINE_STAGES.POS_VENDA]: "Pos-venda",
  [PIPELINE_STAGES.PERDIDO]: "Perdido",
};

export const LEGACY_PIPELINE_STAGE_MAP: Record<string, PipelineStage> = {
  novo: PIPELINE_STAGES.NOVO_LEAD,
  em_atendimento: PIPELINE_STAGES.QUALIFICANDO,
  proposta: PIPELINE_STAGES.ORCAMENTO_ENVIADO,
  fechado: PIPELINE_STAGES.RESERVA_CONFIRMADA,
  perdido: PIPELINE_STAGES.PERDIDO,
};

export const PIPELINE_TERMINAL_STAGE_VALUES = [
  PIPELINE_STAGES.PERDIDO,
  LEGACY_PIPELINE_STAGE_MAP.perdido,
  "perdido",
] as const;

const PIPELINE_STAGE_SET = new Set<string>(PIPELINE_STAGE_ORDER);

export function normalizePipelineStage(stage: string): PipelineStage {
  return LEGACY_PIPELINE_STAGE_MAP[stage] ?? (stage as PipelineStage);
}

export function isPipelineStage(stage: string): stage is PipelineStage {
  return PIPELINE_STAGE_SET.has(stage) || stage in LEGACY_PIPELINE_STAGE_MAP;
}

export function comparePipelineStages(left: string, right: string): number {
  const leftIndex = PIPELINE_STAGE_ORDER.indexOf(normalizePipelineStage(left));
  const rightIndex = PIPELINE_STAGE_ORDER.indexOf(normalizePipelineStage(right));

  if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
  if (leftIndex === -1) return 1;
  if (rightIndex === -1) return -1;

  return leftIndex - rightIndex;
}
