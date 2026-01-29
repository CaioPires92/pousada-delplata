## 1) Critérios de MVP (Minimum Viable Product)
**Objetivo do MVP**: permitir que um hóspede real **encontre disponibilidade**, **faça uma reserva**, **pague**, receba **confirmação**, e que o time interno consiga **operar** (ajustar tarifas/inventário e acompanhar reservas) com segurança e mínima fricção.

**MVP funcional (mínimo essencial)**
- **Site público**
  - Home + páginas de conteúdo básicas (acomodações, contato, lazer/restaurante) publicadas e navegáveis.
  - Página de lista e detalhe de acomodações com fotos e informações.
- **Motor de reservas**
  - Busca por check-in/check-out + adultos/crianças.
  - Cálculo de preço total e aplicação de regras (stopSell/CTA/CTD/minLos) e inventário.
  - Criação de reserva persistida no banco.
- **Pagamento e pós-pagamento**
  - Geração de preferência Mercado Pago e redirecionamento.
  - Página de confirmação com status.
  - Webhook operacional atualizando status e disparando e-mail.
- **Operação (admin)**
  - Login e proteção de acesso.
  - Gestão de quartos (CRUD mínimo) e fotos (ao menos manutenção via banco).
  - Gestão de tarifas/inventário (calendário/edição em lote) para operar preços e disponibilidade.
  - Listagem de reservas e detalhes.
- **Segurança mínima**
  - Rotas sensíveis protegidas (admin e mutações de dados).
  - Segredos fora do repositório.
- **Infra mínima**
  - Deploy repetível (Vercel) + banco (Turso/LibSQL) configurado.
  - CI rodando lint/test/build.

**Não-MVP (pode ficar para depois)**
- CMS completo para editar páginas/galeria.
- iCal export.
- Relatórios avançados, cupons, reviews.

## 2) Avaliação do estado atual (o que existe hoje)
**O que já está implementado e funcional (pelo código e docs)**
- **Site público + páginas**: Home, Acomodações (lista/detalhe), Reservar, Contato/Lazer/Restaurante.
  - Referências: [page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/page.tsx), [acomodacoes/page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/acomodacoes/page.tsx), [reservar/page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/reservar/page.tsx)
- **Motor de disponibilidade**: `GET /api/availability` (regras + inventário + bookings).
  - Referência: [availability/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/availability/route.ts)
- **Reserva**: `POST /api/bookings` cria Booking PENDING; `GET /api/bookings/[id]` retorna detalhes.
  - Referências: [bookings/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/bookings/route.ts), [bookings/[bookingId]/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/bookings/%5BbookingId%5D/route.ts)
- **Pagamento (Mercado Pago)**: criação de preference e redirecionamento.
  - Referência: [create-preference/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/mercadopago/create-preference/route.ts)
- **Webhooks**: existem **dois endpoints** (risco de duplicidade/divergência).
  - Referências: [api/webhooks/mercadopago/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/webhooks/mercadopago/route.ts), [api/mercadopago/webhook/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/mercadopago/webhook/route.ts)
- **E-mails**: endpoint de envio de confirmação existe.
  - Referência: [send-confirmation/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/emails/send-confirmation/route.ts)
- **Admin**: login, dashboard, reservas, quartos, mapa/calendário com tarifas/inventário + bulk update.
  - Referências: [admin/login/page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/admin/login/page.tsx), [admin/mapa/page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/admin/mapa/page.tsx)
- **CI/CD**: workflows existentes e docs de deploy.
  - Referências: [ci.yml](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/.github/workflows/ci.yml), [deploy.yml](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/.github/workflows/deploy.yml), [VERCEL_DEPLOY.md](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/VERCEL_DEPLOY.md)
- **Testes automatizados (Vitest)**: 5 suites (API + página reservar).
  - Arquivos: [route.test.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/availability/route.test.ts), [create-preference/route.test.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/mercadopago/create-preference/route.test.ts), etc.

**Lacunas/riscos relevantes para “MVP pronto para usuários reais”**
- **Segurança (crítico/bloqueante)**
  - Middleware tem matcher para `/api/admin/*`, mas só valida quando o path começa com `/admin`. Ou seja: **as APIs admin podem ficar desprotegidas**.
    - Referência: [middleware.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/middleware.ts)
  - Existem rotas mutáveis fora de `/api/admin/*` (ex.: rooms/rates/inventory) que aparentam permitir mutações sem auth.
  - **Segredos expostos em arquivos do repositório** (ex.: tokens e credenciais em `ENV_VARIAVEIS_CORRETAS.txt` e `CI_CD_FINAL_CONFIG.md`). Isso exige **revogação/rotação**.
    - Referências: [ENV_VARIAVEIS_CORRETAS.txt](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/ENV_VARIAVEIS_CORRETAS.txt), [CI_CD_FINAL_CONFIG.md](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/CI_CD_FINAL_CONFIG.md)
- **Operação/consistência**
  - Dois webhooks com lógicas diferentes → risco de dupla atualização, inconsistência de status e duplicidade de e-mails.
  - Booking creation não “trava” inventário (risco de overbooking em concorrência). Para MVP pode ser aceitável se baixo volume, mas é um risco operacional.
- **Requisitos do PRD que não aparecem implementados**
  - iCal export e CMS para editar páginas/galeria não estão evidentes como rotas/funcionalidades.
    - Referência PRD: [PRD.md](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/docs/PRD.md)
- **Métricas/observabilidade**
  - Não há tracking/analytics nem error monitoring (Sentry) no código.
    - Referência de recomendação: [PRODUCTION_CHECKLIST.md](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/PRODUCTION_CHECKLIST.md)

**Conclusão técnica (até aqui, só por leitura do repo)**
- Você tem um **MVP funcional do ponto de vista de produto** (site + reserva + pagamento + admin básico).
- Você **não tem um “MVP pronto para lançamento público com segurança”** por causa de itens bloqueantes (segredos expostos + proteção incompleta de rotas/admin + superfície de mutação pública + duplicidade de webhooks).

## 3) Testes de validação (o que eu vou executar na próxima etapa)
Como o modo atual é de planejamento (sem execução), a validação prática será feita após sua confirmação. O pacote de testes será:
- **Automatizados (local/CI)**
  - `npm run lint`
  - `npm run test:coverage`
  - `npm run build`
- **E2E manual guiado (checklist objetivo)**
  - Fluxo hóspede: buscar disponibilidade → reservar → gerar payment link → simular retorno `approved/pending/rejected` → conferir página de confirmação.
  - Fluxo webhook: simular payload do MP (e/ou ambiente sandbox) → confirmar que atualiza Booking/Payment e dispara e-mail 1 vez.
  - Fluxo admin: login → editar quarto → editar tarifa/inventário no mapa → verificar disponibilidade no site público.
- **Testes de segurança (mínimos)**
  - Confirmar que `/api/admin/*` exige cookie/token.
  - Confirmar que mutações sensíveis fora de admin estão bloqueadas/retornam 401.

## 4) Documentação e métricas (estado e lacunas)
- **Docs existentes**: há checklists e guias (deploy, produção, admin), mas:
  - README do app é genérico e falta um “Runbook” curto (como operar dia a dia).
  - Há docs com segredos — isso precisa ser removido e substituído por templates.
- **Métricas**: não encontrei analytics/telemetria. Para MVP de lançamento, mínimo recomendado:
  - Métricas de funil (busca → reserva → pagamento aprovado).
  - Erros de webhook/e-mail (observabilidade).

## 5) Recomendações específicas (priorizadas)
**P0 – Bloqueantes para lançamento**
- Remover segredos do repositório e **rotacionar**:
  - Tokens Turso, SMTP, Mercado Pago, Vercel.
- Corrigir proteção de admin:
  - Proteger `/api/admin/*` de verdade (middleware + validação server-side) e alinhar estratégia de auth (evitar só localStorage).
- Fechar rotas mutáveis públicas:
  - `rooms/rates/inventory` devem exigir auth (idealmente dentro de `/api/admin/*`).
- Unificar webhooks:
  - Um único endpoint, validação consistente, idempotência (não mandar e-mail duas vezes).

**P1 – Alta prioridade (muito recomendado)**
- Mitigar overbooking:
  - Revalidação atômica de disponibilidade na criação de booking e/ou mecanismo de hold com expiração.
- Padronizar status Payment/Booking e mapear corretamente status do Mercado Pago.
- Ajustar variáveis de ambiente para uma única fonte de base URL.

**P2 – Médio prazo**
- Instrumentar métricas (ex.: analytics simples) e observabilidade (Sentry).
- Implementar cancelamento e liberação de inventário (requisito operacional importante).
- (Opcional MVP+) iCal export e CMS.

## 6) Critérios de aceitação (“MVP pronto”) – objetivos
O MVP é considerado pronto para usuários iniciais quando:
- **Reserva e pagamento**
  - 10 execuções seguidas em sandbox: `search → booking → payment → webhook → e-mail` sem erro.
  - Webhook é **idempotente** (reprocessar o mesmo evento não duplica e-mail nem muda status incorretamente).
- **Operação**
  - Admin consegue ajustar tarifa e inventário e isso reflete na disponibilidade pública.
  - Admin consegue listar reservas e ver detalhes completos.
- **Segurança**
  - Nenhum segredo em repositório; todos em envs da Vercel/GitHub Secrets.
  - Rotas de admin e mutações retornam 401 sem autenticação.
- **Qualidade mínima**
  - CI passa (lint/test/build) em PR.
  - Páginas-chave funcionam em mobile (telas 360px/768px/1280px).

---

## Próximo passo (após você confirmar este plano)
Eu executo a bateria de validação prática (automatizada + E2E guiado), gero um **Relatório MVP** com status (Pronto / Quase Pronto / Não Pronto) e uma lista P0/P1/P2 com estimativa de risco.