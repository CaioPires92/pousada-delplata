# Pendências — Pousada Delplata

Lista viva do que falta fazer no motor. Os agentes (Claude Code e Codex) leem este arquivo a cada pedido de alteração e lembram o que está aberto (ver `CLAUDE.md` e `AGENTS.md`).

Como manter:
- Marque `[x]` e escreva a data quando concluir; mova para **Concluídas** na próxima edição.
- Pendência nova: inclua o contexto (branch, arquivo, por quê) para dar para retomar sem precisar da conversa.
- Datas no formato AAAA-MM-DD.

## Abertas

### 1. Espelhamento do motor: conferir depois do merge
- PR #6 mesclado em 2026-11-14 (`a7909d5`), deploy de produção Ready. A busca responde em produção e, com pets, só oferece Térreo, Chalé e Anexo.
- [ ] Fazer uma reserva de teste com cartão e conferir que vai para o Checkout Pro e volta confirmada.
- [ ] Conferir no painel do Mercado Pago que o webhook aponta para `https://www.pousadadelplata.com.br/api/webhooks/mercadopago`.

### 2. Reservas que não chegam ao pagamento (investigar)
- 2026-11-18: desde o deploy (2026-11-14) houve 1 reserva (2026-11-16, R$ 309). Ela abriu o Checkout Pro, mas não houve nenhuma tentativa no MP e a reserva expirou. Ainda não há confirmações desde 2026-10-27.
- Entre 2026-11-02 e 2026-11-13 foram 9 reservas criadas e nenhuma tentativa de pagamento no Mercado Pago (consultado por `external_reference`). O último pagamento é de 2026-10-27.
- O PR #6 troca o Brick pelo Checkout Pro. Depois do merge, ver se as tentativas voltam a aparecer.

### 3. Migração do pagamento para o Asaas (branch parada)
- Branch: `feat/migracao-asaas`, criada em 2026-11-13 a partir da branch do espelhamento. Checklist em `docs/ativacao-asaas.md`.
- Só mesclar quando o usuário disser "aplique". Antes disso: conta Asaas aprovada, webhook configurado e `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_ENVIRONMENT=production` na Vercel.
- Depois do merge, esperar uns 120 dias para remover o código do Mercado Pago.

### 4. Limite de pets por reserva
- Taxa definida em 2026-11-13: R$ 20 por pet por diária. O limite continua 10 (herdado do Villa); confirmar com o usuário.

### 5. Checagem "CRM" do CI sempre falha
- `.github/workflows/quality-gates.yml` ainda roda `npm run test:crm`, mas o CRM antigo foi removido em 2026-09-21 (`901d48b`) e o script não existe mais. Ela falha desde 2026-10-28, inclusive na `main`.
- Decisão do usuário: remover o job `crm` do workflow (recomendado) ou recriar o script.

## Concluídas

- 2026-11-18: cron de expiração funcionando com o `CRON_SECRET`; as reservas PENDING de 07/11, 10/11 e 13/11 expiraram (`payment_deadline_passed`).
- 2026-11-18: validação de e-mail do hóspede em produção (PR #7, `485c632`); a API recusa `pepeke@pepeke`.
- 2026-11-14: colunas e tabelas do espelhamento criadas no Turso de produção (`ensure-sync-2026-11-schema.js`, conferido com novo dry-run sem pendências).
- 2026-11-14: `BOOKING_ACCESS_SECRET` e `CRON_SECRET` criados na Vercel (Production); `ENABLE_TEST_PAYMENTS` e `NEXT_PUBLIC_ENABLE_TEST_PAYMENTS` = `false` só em Production.
