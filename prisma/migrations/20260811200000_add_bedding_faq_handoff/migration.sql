INSERT OR IGNORE INTO "ChatbotRule" (
  "id", "trigger", "response", "category", "audience", "source", "version",
  "approvedAt", "approvedBy", "isActive", "createdAt", "updatedAt"
) VALUES
(
  'faq-bed-linen',
  'roupa de cama',
  'Vou confirmar com nossa equipe os detalhes sobre a roupa de cama da acomodação e retorno por aqui.',
  'acomodacoes',
  'public',
  'Resposta segura aprovada pela administração em 11/08/2026; detalhes variam por acomodação',
  1,
  CURRENT_TIMESTAMP,
  'owner',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'faq-bed-details',
  'cama',
  'Vou confirmar com nossa equipe o tipo e o tamanho da cama desta acomodação e retorno por aqui.',
  'acomodacoes',
  'public',
  'Resposta segura aprovada pela administração em 11/08/2026; detalhes variam por acomodação',
  1,
  CURRENT_TIMESTAMP,
  'owner',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
