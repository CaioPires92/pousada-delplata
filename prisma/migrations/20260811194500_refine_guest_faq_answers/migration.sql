UPDATE "ChatbotRule"
SET
  "response" = 'O estacionamento é gratuito. Na ala dos apartamentos, há 5 vagas internas, ocupadas por ordem de chegada, além de vagas externas. Não reservamos vagas internas. Na ala dos chalés, o estacionamento é interno.',
  "source" = 'Informação confirmada pela administração em 11/08/2026',
  "version" = "version" + 1,
  "approvedAt" = CURRENT_TIMESTAMP,
  "approvedBy" = 'owner',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq-parking';

UPDATE "ChatbotRule"
SET
  "response" = 'O check-in começa às 14h, e o check-out deve ser realizado até as 12h.',
  "source" = 'Informação confirmada pela administração em 11/08/2026',
  "version" = "version" + 1,
  "approvedAt" = CURRENT_TIMESTAMP,
  "approvedBy" = 'owner',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq-checkin';

INSERT OR IGNORE INTO "ChatbotRule" (
  "id", "trigger", "response", "category", "audience", "source", "version",
  "approvedAt", "approvedBy", "isActive", "createdAt", "updatedAt"
) VALUES (
  'faq-wifi-password',
  'senha do Wi-Fi',
  'A senha do Wi-Fi é fornecida pela recepção. Se você já estiver hospedado, posso consultar nossa equipe para você.',
  'estrutura',
  'public',
  'Resposta segura aprovada pela administração em 11/08/2026; a senha não foi cadastrada no CRM',
  1,
  CURRENT_TIMESTAMP,
  'owner',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

UPDATE "ChatbotRule"
SET
  "response" = 'A senha do Wi-Fi é fornecida pela recepção. Se você já estiver hospedado, posso consultar nossa equipe para você.',
  "category" = 'estrutura',
  "audience" = 'public',
  "source" = 'Resposta segura aprovada pela administração em 11/08/2026; a senha não foi cadastrada no CRM',
  "approvedAt" = CURRENT_TIMESTAMP,
  "approvedBy" = 'owner',
  "isActive" = 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq-wifi-password' OR "trigger" = 'senha do Wi-Fi';
