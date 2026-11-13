# Espelhamento do motor (Villa Verona / Refúgio Serrano → Delplata), 2026-11

Branch: `sync/motor-villa-refugio`. Origem: Villa Verona `main` (`3e7088d`, mesmo provedor: Mercado Pago) e
correções compartilhadas do Refúgio Serrano `main` (`e83b1dd`). A migração para o Asaas fica de fora e vai numa
branch separada.

## O que entrou

- Pagamento igual ao Villa: todas as reservas pelo Checkout Pro, pagador "outra pessoa" validado no servidor,
  idempotência por tentativa (HMAC do payload), Device ID do MP, `category_id: travels`, `statement_descriptor`,
  histórico de tentativas (`PaymentAttempt`) com `status_detail`, motivos de recusa no admin e na confirmação.
- Webhook (T7): pagamento duplicado alertado, estorno de duplicado não cancela a reserva válida, Pix antigo que
  expira não cancela reserva pendente, alerta de pagamento em reserva expirada sem repetir a cada reentrega.
- Prazo de pagamento de 60 min como regra única (`src/lib/booking-payment-window.ts`), quarto bloqueado durante o
  prazo e na folga, e pagamento após o prazo só confirma se ainda houver quarto.
- Expiração automática, e-mail de recuperação no tempo certo e equipe avisada só de reserva confirmada.
- Promoções (construtor, acúmulo, público mobile, selo, datas excluídas, dias da semana, "Reserva direta").
- Busca unificada (datas, hóspedes e pets) na home, no widget e no `/reservar`.
- Hospedin: controle híbrido de inventário e sincronização automática (desligada até `HOSPEDIN_SYNC_ENABLED=true`).
- Segurança: cabeçalhos/CSP, rotas de e-mail fechadas, página pública da reserva com dados mínimos, scripts de
  banco com trava (`scripts/shared/db-safety.js`), seed destrutivo só em banco local.
- Dependências atualizadas (Next 16.4.5, nodemailer 10, Sentry 10.76).

## Diferenças mantidas de propósito

- Visual do Delplata (cards de quarto, home, header, barra de reserva do celular, cores). Os componentes de busca
  vindos do Villa usam os tokens `brand-*`, mapeados para a paleta do Delplata em `globals.css`/`tailwind.config.ts`.
- Pets: só pequeno porte, com taxa, apenas em Apartamento Térreo, Chalé e Apartamento Anexo
  (`src/lib/pet-policy.ts`). O Superior não aparece na busca com pets e a API recusa (`pets_not_allowed`).
- GA4/Clarity, domínio, quartos e fotos continuam os do Delplata.

## Banco de produção (Turso), ANTES do merge

O Prisma passa a ler colunas novas de `Booking`. Se o merge for antes da migração, o site quebra (P2022).
Todas as migrações são aditivas (sem alterar dados):

| Migração | O que cria |
|---|---|
| 20261015120000_add_booking_hospedin_registration | `Booking.hospedinReservationId`, `hospedinRegisteredAt` + índice |
| 20261017220000_add_payment_attempt_history | tabela `PaymentAttempt` |
| 20261020003000_add_booking_pets | `Booking.pets` (default 0) |
| 20261029170000_add_hybrid_hospedin_inventory | `InventoryAdjustment.hospedinUnits`, `manualOverrideUnits`, `hospedinSyncedAt` |
| 20261109120000_add_promotions | tabela `Promotion` + `Booking.promotionId/Name/Discount` |
| 20261109180000_promotion_builder | colunas de acúmulo + `Booking.promotionBreakdown` |
| 20261111140000 … 20261111200000 | `Promotion.audience`, `showBadge`, `excludedStayDates`, `daysOfWeek` |
| 20261112220000_booking_payment_deadline | `Booking.paymentDeadlineAt` + índice |

Aplicar com o script protegido, que cria só o que faltar (primeiro o dry-run, conferir a lista, depois confirmar):

```bash
node scripts/reservas/db/ensure-sync-2026-11-schema.js --dry-run --allow-remote --confirm-host=<host do Turso>
```

Não use `apply_migrations_turso.js` aqui: se o banco não tiver histórico em `_app_migrations`, ele marca todas as
migrações como aplicadas sem executar o SQL, e as colunas novas não seriam criadas.

## Variáveis na Vercel (produção), ANTES do merge

| Variável | Situação | Observação |
|---|---|---|
| `BOOKING_ACCESS_SECRET` | falta | Obrigatória: o build falha sem ela (`verify:security`). |
| `CRON_SECRET` | falta | Sem ela o cron de expiração (`/api/cron/cleanup-bookings`) responde erro. |
| `ENABLE_TEST_PAYMENTS` | existe | Precisa estar exatamente `false`. |
| `HOSPEDIN_SYNC_ENABLED` | falta | Opcional. `true` liga a sincronização automática do estoque. |
| `PENDING_BOOKING_PAYMENT_WINDOW_MINUTES` | falta | Opcional (padrão 60). |

O build agora roda `verify:production` (checagem de segurança + typecheck + testes) antes do `next build`.

## Pendências

- Valor da taxa de pet e limite de pets por reserva (hoje R$ 40 por pet por noite, até 10 pets, herdado do Villa).
- Auditoria de aprovação do Mercado Pago no banco de produção (consultas só de leitura), pendente de acesso.
- Webhook do Mercado Pago: conferir no painel do MP que a URL é `https://www.pousadadelplata.com.br/api/webhooks/mercadopago`.
