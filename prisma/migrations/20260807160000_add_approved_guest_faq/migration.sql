ALTER TABLE "ChatbotRule" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "ChatbotRule" ADD COLUMN "source" TEXT;
ALTER TABLE "ChatbotRule" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ChatbotRule" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "ChatbotRule" ADD COLUMN "approvedBy" TEXT;

INSERT OR IGNORE INTO "ChatbotRule" ("id", "trigger", "response", "category", "audience", "source", "version", "approvedAt", "approvedBy", "isActive", "createdAt", "updatedAt") VALUES
('faq-checkin', 'check-in', 'O check-in é realizado a partir das 14h.', 'horarios', 'public', 'Informação confirmada pela administração em 07/08/2026', 1, CURRENT_TIMESTAMP, 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('faq-checkout', 'check-out', 'O check-out deve ser realizado até as 12h.', 'horarios', 'public', 'Informação confirmada pela administração em 07/08/2026', 1, CURRENT_TIMESTAMP, 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('faq-breakfast', 'café da manhã', 'O café da manhã é servido das 8h30 às 10h30.', 'horarios', 'public', 'Informação confirmada pela administração em 07/08/2026', 1, CURRENT_TIMESTAMP, 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('faq-reception', 'recepção', 'Nossa recepção funciona 24 horas.', 'horarios', 'public', 'Informação confirmada pela administração em 07/08/2026', 1, CURRENT_TIMESTAMP, 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('faq-parking', 'estacionamento', 'O estacionamento é gratuito. Na ala dos apartamentos há vagas internas e externas, mas as vagas internas não são reservadas nem garantidas. Na ala dos chalés, o estacionamento é interno.', 'estrutura', 'public', 'Informação confirmada pela administração em 07/08/2026', 1, CURRENT_TIMESTAMP, 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('faq-pets', 'pet', 'Aceitamos até dois pets de pequeno porte, com até 10 kg cada, nos apartamentos térreos, chalés e apartamentos anexos. Para mais de dois pets, é necessário consultar nossa equipe.', 'politicas', 'public', 'Informação confirmada pela administração em 07/08/2026', 1, CURRENT_TIMESTAMP, 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('faq-pools', 'piscina', 'As piscinas funcionam das 10h às 20h. A ala principal possui piscina adulta e infantil, e a ala dos chalés possui piscina adulta.', 'estrutura', 'public', 'Informação confirmada pela administração em 07/08/2026', 1, CURRENT_TIMESTAMP, 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('faq-barbecue', 'churrasqueira', 'As churrasqueiras funcionam das 10h às 22h e precisam ser reservadas conforme disponibilidade. A taxa de limpeza é de R$ 20. Temos três churrasqueiras na ala principal e uma na ala dos chalés.', 'estrutura', 'public', 'Informação confirmada pela administração em 07/08/2026', 1, CURRENT_TIMESTAMP, 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('faq-visitors', 'visitante', 'A entrada de visitantes precisa ser consultada previamente com nossa equipe.', 'politicas', 'public', 'Informação confirmada pela administração em 07/08/2026', 1, CURRENT_TIMESTAMP, 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
