INSERT OR IGNORE INTO "ChatbotRule" (
  "id", "trigger", "response", "category", "audience", "source", "version",
  "approvedAt", "approvedBy", "isActive", "createdAt", "updatedAt"
) VALUES
(
  'faq-window',
  'janela',
  'A presença de janela varia conforme a acomodação. Vou confirmar com nossa equipe a configuração da unidade disponível e retorno por aqui.',
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
  'faq-windows',
  'janelas',
  'A presença de janela varia conforme a acomodação. Vou confirmar com nossa equipe a configuração da unidade disponível e retorno por aqui.',
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
