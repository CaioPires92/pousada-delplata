UPDATE "ChatbotRule"
SET
  "response" = 'A senha do Wi-Fi é pousada151 em todas as redes.',
  "source" = 'Informação confirmada pela administração em 11/08/2026',
  "version" = "version" + 1,
  "approvedAt" = CURRENT_TIMESTAMP,
  "approvedBy" = 'owner',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq-wifi-password';

UPDATE "ChatbotRule"
SET
  "response" = 'Somente os apartamentos térreos não possuem janelas. As demais acomodações possuem janelas.',
  "source" = 'Informação confirmada pela administração em 11/08/2026',
  "version" = "version" + 1,
  "approvedAt" = CURRENT_TIMESTAMP,
  "approvedBy" = 'owner',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('faq-window', 'faq-windows');
