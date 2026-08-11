INSERT OR IGNORE INTO "ChatbotRule" (
  "id", "trigger", "response", "category", "audience", "source", "version",
  "approvedAt", "approvedBy", "isActive", "createdAt", "updatedAt"
) VALUES
(
  'faq-voltage',
  'voltagem',
  'A voltagem varia conforme a acomodação: apartamentos térreos e superiores possuem tomadas de 220 V; chalés e apartamentos anexos possuem tomadas de 110 V.',
  'acomodacoes',
  'public',
  'Informação pública das acomodações confirmada em 11/08/2026',
  1,
  CURRENT_TIMESTAMP,
  'owner',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'faq-outlet',
  'tomada',
  'A voltagem varia conforme a acomodação: apartamentos térreos e superiores possuem tomadas de 220 V; chalés e apartamentos anexos possuem tomadas de 110 V.',
  'acomodacoes',
  'public',
  'Informação pública das acomodações confirmada em 11/08/2026',
  1,
  CURRENT_TIMESTAMP,
  'owner',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'faq-outlets',
  'tomadas',
  'A voltagem varia conforme a acomodação: apartamentos térreos e superiores possuem tomadas de 220 V; chalés e apartamentos anexos possuem tomadas de 110 V.',
  'acomodacoes',
  'public',
  'Informação pública das acomodações confirmada em 11/08/2026',
  1,
  CURRENT_TIMESTAMP,
  'owner',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'faq-electrical-voltage',
  'tensão',
  'A voltagem varia conforme a acomodação: apartamentos térreos e superiores possuem tomadas de 220 V; chalés e apartamentos anexos possuem tomadas de 110 V.',
  'acomodacoes',
  'public',
  'Informação pública das acomodações confirmada em 11/08/2026',
  1,
  CURRENT_TIMESTAMP,
  'owner',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
