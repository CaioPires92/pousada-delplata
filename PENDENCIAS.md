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
- Taxa: R$ 20 por pet por diária (2026-11-13). Limite: até 10 pets por reserva (herdado do Villa), mantido por decisão do usuário em 2026-11-18.
- Rever depois: com "pequeno porte", talvez faça sentido 1 ou 2 por reserva (`src/app/api/bookings/route.ts`, `src/lib/booking-price.ts`).

### 5. (Opcional) Upstash para o limite de login do admin
- Hoje o login bloqueia após 5 senhas erradas em 15 min, mas a contagem fica na memória de cada servidor da Vercel (zera ao reiniciar e não é compartilhada). Com Upstash, o limite vale de verdade.
- Não é urgente se a senha do admin for forte e única. Para ativar: conta gratuita no Upstash e `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` na Vercel (Production). O código já usa se existirem (`src/app/api/admin/login/route.ts`).

### 6. Estoque de 4 hóspedes antes de mesclar o PR de 4 pagantes
- Branch `fix/idade-e-4-hospedes` (2026-11-20): a busca passa a aceitar até 4 pagantes (adultos e crianças de 6 a 11) e a reserva usa o estoque de 4 hóspedes do quarto, que é um pedaço do estoque do STD (reserva de 4 baixa os dois; STD lotado fecha a de 4).
- 2026-11-20: estoque de 4 zerado em produção em todos os quartos (antes 2 no Térreo, no Chalé e no Superior), conferido na API pública. O usuário abre dia a dia no mapa.
- Mesmo PR: 1 criança de 0 a 5 anos pode ficar além dos 4 pagantes (máx. 5 pessoas), com o aviso "Criança de 0 a 5 anos é cortesia e não tem cama extra: dorme com os responsáveis." O usuário precisa aprovar esse texto antes de mesclar.
- Limite: o Hospedin manda só a quantidade livre por tipo, sem o número do quarto. O motor não sabe se o quarto livre é um dos que cabem 4; o estoque de 4 serve de teto e precisa ser ajustado na mão quando os quartos de 4 forem ocupados por fora do site.

## Concluídas

- 2026-11-20: `CRON_SECRET` gerado de novo (o dono gravou o mesmo valor na Vercel e em `HOSPEDIN_CRON_SECRET` no GitHub) + redeploy. Disparo manual ok: 61 dias × 4 quartos; Superior mudou 2 dias; Térreo 20–21/11 tinha ajuste manual 1 (Hospedin 1 livre); a pedido do dono voltou ao automático (site 0).
- 2026-11-19: sincronização de disponibilidade com o Hospedin LIGADA. `HOSPEDIN_SYNC_ENABLED=true` na Vercel e no GitHub, `CRON_SECRET` trocado (o mesmo valor em `HOSPEDIN_CRON_SECRET` no GitHub), `HOSPEDIN_PASSWORD` atualizada, deploy feito. Primeira rodada ok (61 dias × 4 quartos) e GitHub Action a cada 30 min com sucesso. O site agora mostra livres do Hospedin − 1 (ex.: Superior 05/12 e 24/12 = 0; antes 2 fixos).

- 2026-11-18: validação de e-mail também no Villa (PR #10, `d02f592`) e no Refúgio (PR #12, `503af51`); conferido nos sites no ar.
- 2026-11-18: job `crm` removido do CI (PR #9, `cd7d441`).
- 2026-11-18: cron de expiração funcionando com o `CRON_SECRET`; as reservas PENDING de 07/11, 10/11 e 13/11 expiraram (`payment_deadline_passed`).
- 2026-11-18: validação de e-mail do hóspede em produção (PR #7, `485c632`); a API recusa `pepeke@pepeke`.
- 2026-11-14: colunas e tabelas do espelhamento criadas no Turso de produção (`ensure-sync-2026-11-schema.js`, conferido com novo dry-run sem pendências).
- 2026-11-14: `BOOKING_ACCESS_SECRET` e `CRON_SECRET` criados na Vercel (Production); `ENABLE_TEST_PAYMENTS` e `NEXT_PUBLIC_ENABLE_TEST_PAYMENTS` = `false` só em Production.
