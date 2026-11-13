# Pendências — Pousada Delplata

Lista viva do que falta fazer no motor. Os agentes (Claude Code e Codex) leem este arquivo a cada pedido de alteração e lembram o que está aberto (ver `CLAUDE.md` e `AGENTS.md`).

Como manter:
- Marque `[x]` e escreva a data quando concluir; mova para **Concluídas** na próxima edição.
- Pendência nova: inclua o contexto (branch, arquivo, por quê) para dar para retomar sem precisar da conversa.
- Datas no formato AAAA-MM-DD.

## Abertas

### 1. Espelhamento do motor (PR #6, aguardando merge)
- Branch: `sync/motor-villa-refugio`, criada em 2026-11-13. Detalhes em `docs/ops/sync-motores-2026-11.md`.
- **Antes do merge:**
  - [ ] Criar as colunas e tabelas novas no Turso: `node scripts/reservas/db/ensure-sync-2026-11-schema.js --confirm=YES --allow-remote --confirm-host=pousada-delplata-caiopires92.aws-us-west-2.turso.io`. O dry-run em produção foi feito em 2026-11-13 e a lista bateu com o teste local.
  - [ ] Vercel (Production): criar `BOOKING_ACCESS_SECRET` (sem ela o build falha) e `CRON_SECRET` (sem ela o cron de expiração falha; já falhava antes, porque há reservas PENDING de 2026-11-07 que não expiraram).
- **Depois do merge:**
  - [ ] Fazer uma reserva de teste com cartão e conferir que vai para o Checkout Pro e volta confirmada.
  - [ ] Conferir no painel do Mercado Pago que o webhook aponta para `https://www.pousadadelplata.com.br/api/webhooks/mercadopago`.

### 2. Reservas que não chegam ao pagamento (investigar)
- Entre 2026-11-02 e 2026-11-13 foram 9 reservas criadas e nenhuma tentativa de pagamento no Mercado Pago (consultado por `external_reference`). O último pagamento é de 2026-10-27.
- O PR #6 troca o Brick pelo Checkout Pro. Depois do merge, ver se as tentativas voltam a aparecer.

### 3. Migração do pagamento para o Asaas (branch parada)
- Branch: `feat/migracao-asaas`, criada em 2026-11-13 a partir da branch do espelhamento. Checklist em `docs/ativacao-asaas.md`.
- Só mesclar quando o usuário disser "aplique". Antes disso: conta Asaas aprovada, webhook configurado e `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_ENVIRONMENT=production` na Vercel.
- Depois do merge, esperar uns 120 dias para remover o código do Mercado Pago.

### 4. Limite de pets por reserva
- Taxa definida em 2026-11-13: R$ 20 por pet por diária. O limite continua 10 (herdado do Villa); confirmar com o usuário.

## Concluídas
