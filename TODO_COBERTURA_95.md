# Plano de Ação: Cobertura ≥95%

Meta: elevar a cobertura de testes automatizados para, no mínimo, 95% do código, priorizando rotas críticas e invariantes de negócio. Executar com testes unitários, de integração e alguns E2E leves onde fizer sentido.

## Como medir e acompanhar

- [ ] Executar testes
  - Comando: `npm run test` (pasta: `web`)
- [ ] Gerar relatório de cobertura
  - Comando: `npm run test:coverage` (text/json/html)
  - Abrir `coverage/index.html` para visualizar arquivos com menor cobertura
- [ ] Registrar meta por área
  - Auth/Admin: ≥98%
  - Webhooks MP: ≥97%
  - Reservas/Disponibilidade: ≥95%
  - UI crítica (SearchWidget/Reservar): ≥90–95%
  - Utilitários/libs: ≥98%

## Autenticação e Admin

- [ ] Middleware admin protegido
  - Rotas que devem exigir auth: `/admin/*`, `/api/admin/*`
  - Casos: sem token → redirect/401; `ADMIN_JWT_SECRET` ausente → 500 (dev/test); token inválido/expirado → 401; token válido → next
  - Arquivo: [middleware.ts](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/middleware.ts)
- [ ] requireAdminAuth
  - Casos: secret ausente (500 dev/test), sem cookie (401), token inválido (401), token válido (claims)
  - Arquivo: [admin-auth.ts](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/lib/admin-auth.ts)
- [ ] JWT admin (assinatura/verificação)
  - Assinar com expiração/jti; verificar claims inválidas; role deve ser `admin`
  - Arquivo: [admin-jwt.ts](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/lib/admin-jwt.ts)

## Webhooks Mercado Pago

- [ ] Assinatura
  - Headers ausentes → 401 (quando há segredo)
  - Formato inválido → 401
  - HMAC inválido → 401
- [ ] Configuração
  - `MP_ACCESS_TOKEN` ausente → 500
  - Falha no fetch do MP (4xx/5xx) → 502
- [ ] Estados de pagamento
  - `approved` → Booking CONFIRMED e email enfileirado; Payment APPROVED
  - `rejected`/`cancelled`/`refunded`/`charged_back` → Booking CANCELLED (se PENDING), Payment REJECTED (se não APPROVED)
  - `pending` → sem mudança de status
  - Booking inexistente → 404
  - Arquivo: [webhook-handler.ts](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/lib/mercadopago/webhook-handler.ts)
  - Rota: [route.ts](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/webhooks/mercadopago/route.ts)

## Reservas e Disponibilidade

- [ ] Validações de entrada
  - Datas no passado
  - `checkOut` igual/antes de `checkIn`
  - Exceder capacidade
  - Tipos inválidos (strings onde se espera números)
  - Email inválido (na criação de reserva)
- [ ] Fluxos de sucesso e erro
  - Reserva criada com dados válidos
  - Disponibilidade retorna lista e “sem disponibilidade” corretamente
  - Arquivos: [bookings/route](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/bookings/route.ts), [availability/route](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/availability/route.ts)

## UI Crítica (Frontend)

- [ ] SearchWidget
  - Habilitar/desabilitar “Buscar” conforme idades e datas
  - Alerts de validação (mock `window.alert`)
  - Submissão chama `/api/availability` com parâmetros corretos
  - Mensagem “sem disponibilidade”
  - Arquivo: [SearchWidget.tsx](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/components/SearchWidget.tsx)
- [ ] ReservarPage
  - Loading inicial, renderização de quartos
  - Fallback de fotos locais quando URLs placeholder
  - Tratamento de erro (fetch falha)
  - Arquivo: [reservar/page.tsx](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/app/reservar/page.tsx)
- [ ] Calendar wrapper
  - Renderização e composição de classes com `className`
  - Opcional: callbacks `onSelect` com estados simples
  - Arquivo: [ui/calendar.tsx](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/components/ui/calendar.tsx)

## Rates Bulk (Admin)

- [ ] Normalização de data para chave `YYYY-MM-DD`
- [ ] Aceitar ISO datetime e strings legadas, mantendo a mesma chave de dia
- [ ] Transações com replace de rates/inventory conforme entrada
- Arquivo: [rates/bulk/route](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/rates/bulk/route.ts)

## Utilitários e Libs

- [ ] date-utils
  - Normalização de datas, chaves de dia e comparações
  - Arquivo: [date-utils](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/lib/date-utils.ts)
- [ ] booking-price
  - Invariantes: extras por noite, crianças 12+ contam como adultos, <6 grátis
  - Arquivo: [booking-price](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/lib/booking-price.ts)
- [ ] ops-log/Sentry
  - Em erros críticos, garantir chamada e payloads consistentes
  - Arquivo: [ops-log](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/web/src/lib/ops-log.ts)

## Padrões de Teste e Guardrails

- [ ] Mocks isolados
  - `vi.mock` para Prisma, `next/headers`, `next/navigation`, `fetch` global e email
- [ ] Reset de módulos
  - `vi.resetModules()` antes de trocar mocks do mesmo módulo em casos diferentes
- [ ] Evitar fragilidade
  - Testar invariantes e resultados (status, JSON, redirects), não detalhes de layout
  - Usar `findBy*` para esperar atualizações assíncronas

## Integração em CI

- [ ] Adicionar etapa de testes e cobertura no pipeline
  - Falhar abaixo de 95% de cobertura global
  - Publicar `coverage/index.html` como artifact
- [ ] Scripts
  - `npm run test` / `npm run test:coverage`
  - Opcional: relatório agregado em PRs

## Critérios de Aceitação

- [ ] Cobertura global ≥95% (report V8/HTML)
- [ ] Suites estáveis (sem flakiness)
- [ ] Testes executam em <1 min em ambiente padrão
- [ ] Áreas críticas atingem metas por módulo (listadas acima)

## Referências úteis

- Plano QA: [PLANO_QA_TESTES.md](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/PLANO_QA_TESTES.md)
- Relatório QA: [RELATORIO_FINAL_QA.md](file:///c:/Users/caiog/OneDrive/Área%20de%20Trabalho/trae/Delplata-Motor/RELATORIO_FINAL_QA.md)
