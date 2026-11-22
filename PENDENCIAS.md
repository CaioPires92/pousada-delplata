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

### 4. Limite de pets por reserva — resolvido, mover para Concluídas na próxima edição
- 2026-11-22: limite de 2 pets por reserva (decisão do usuário; antes 10, herdado do Villa). Valor central em `MAX_PETS_PER_BOOKING` (`src/lib/pet-policy.ts`), aplicado na busca, no seletor, na API de reservas (`invalid_pet_count`), na cotação e no preço. Taxa continua R$ 20 por pet por diária. Falta conferir em produção após o deploy.
- O Villa segue com 10 pets e R$ 40 por pet por diária; não foi alterado.

### 5. (Opcional) Upstash para o limite de login do admin
- Hoje o login bloqueia após 5 senhas erradas em 15 min, mas a contagem fica na memória de cada servidor da Vercel (zera ao reiniciar e não é compartilhada). Com Upstash, o limite vale de verdade.
- Não é urgente se a senha do admin for forte e única. Para ativar: conta gratuita no Upstash e `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` na Vercel (Production). O código já usa se existirem (`src/app/api/admin/login/route.ts`).

### 6. Estoque de 4 hóspedes antes de mesclar o PR de 4 pagantes
- Branch `fix/idade-e-4-hospedes` (2026-11-20): a busca passa a aceitar até 4 pagantes (adultos e crianças de 6 a 11) e a reserva usa o estoque de 4 hóspedes do quarto, que é um pedaço do estoque do STD (reserva de 4 baixa os dois; STD lotado fecha a de 4).
- 2026-11-20: estoque de 4 zerado em produção em todos os quartos (antes 2 no Térreo, no Chalé e no Superior), conferido na API pública. O usuário abre dia a dia no mapa.
- 1 criança de 0 a 5 anos pode ficar além da capacidade do quarto usado (STD = 3 até 3 pagantes; quarto de 4 com 4 pagantes). O aviso "Criança de até 5 anos é cortesia, sem cama extra." só aparece nesse caso (ajuste pedido pelo usuário em 2026-11-20).
- Limite: o Hospedin manda só a quantidade livre por tipo, sem o número do quarto. O motor não sabe se o quarto livre é um dos que cabem 4; o estoque de 4 serve de teto e precisa ser ajustado na mão quando os quartos de 4 forem ocupados por fora do site.

### 7. Reserva do site → Hospedin (código pronto, desligado)
- Branch `feat/hospedin-reserva` (2026-11-20), usando a API v3 do Hospedin (Client ID + Secret; doc em `https://pms.hospedin.com/api-docs/v3/swagger.yaml`). Reserva confirmada no site → o site escolhe um quarto livre do tipo (a v3 exige o quarto), cria o hóspede como "SITE - Nome", cria a reserva no canal "Site" (222289) com o total das diárias e lança o valor pago (conta "Caixa Diário", categoria "Reserva"). Observação leva todos os detalhes (contato, idades, pets, promoção, cupom, total, pagamento, saldo e prazo). Nunca troca o tipo de quarto reservado. Cancelada/expirada/estornada no site → `POST /bookings/{id}/cancel`. Envio na hora da confirmação e, para o que escapar, a cada 30 min no cron do Hospedin (`src/lib/hospedin-push.ts`).
- Desligado até `HOSPEDIN_PUSH_ENABLED=true` + `HOSPEDIN_PUSH_SINCE` + `HOSPEDIN_SITE_SALE_CHANNEL_ID` + `HOSPEDIN_CLIENT_ID`/`HOSPEDIN_CLIENT_SECRET` na Vercel. A data de corte existe porque a equipe já lança as reservas do site à mão: depois de ligar, ela para de lançar as novas.
- [x] 2026-11-20: login na v3 e leitura conferidos (conta 906, 10 canais, 5 tipos e 33 quartos, disponibilidade por quarto).
- [x] 2026-11-20: reserva de teste SI:020780 criada pela v3 (Chalé 28, 15→16/06/2027, canal Site, R$ 1,00), conferida no painel pelo usuário e cancelada pela API; o quarto voltou a ficar livre. O hóspede de teste não pode ser apagado (tem histórico) e foi desativado. O lançamento de pagamento ainda não foi testado de verdade.
- [x] 2026-11-20: quartos que recebem 4: Térreo 6 e 8, Superior 9 e 16 (casal + beliche) e Chalés 23 e 24 (casal + solteiro, recebem 4 segundo o usuário) → `HOSPEDIN_FOUR_GUEST_PLACE_IDS=20181,20183,20184,20191,20201,20202`. Teto do estoque de 4 no site: Térreo 2, Superior 2, Chalé 2, Anexo 0 (pendência 6).
- [x] 2026-11-20: PR #21 aberto; na Vercel (Production) já estão `HOSPEDIN_CLIENT_ID`, `HOSPEDIN_CLIENT_SECRET`, `HOSPEDIN_SITE_SALE_CHANNEL_ID=222289`, `HOSPEDIN_FOUR_GUEST_PLACE_IDS` e `HOSPEDIN_PUSH_ENABLED=false`.
- [x] 2026-11-20: PR #21 mesclado (`e2f74e6`) e deploy de produção Ready; o site e a cotação respondem, envio ao Hospedin no ar mas desligado.
- [ ] Combinar com a equipe a data e hora de corte, pôr `HOSPEDIN_PUSH_SINCE` e `HOSPEDIN_PUSH_ENABLED=true` na Vercel e fazer um redeploy.
- Depois: migrar a sincronização de estoque da v2 (e-mail e senha) para a v3 e avaliar gravar preços/restrições pela v3 (`PUT /prices`, `/restrictions`, `/closures`).
- [ ] Ligar na Vercel e acompanhar os logs `HOSPEDIN_PUSH_*` na primeira semana. Trava `pending:` parada = conferir no Hospedin se a reserva foi criada (o sistema não reenvia sozinho para não duplicar).
- Estoque: reserva enviada deixa de contar no estoque geral do site (o Hospedin já desconta), mas continua contando no estoque de 4 hóspedes, que só existe no site.

## Concluídas

- 2026-11-22: favicon novo (o "D" prata do próprio logo sobre verde, com moldura dourada): o `src/app/favicon.ico` antigo estava corrompido (cabeçalho inválido), por isso nenhum navegador mostrava ícone. Agora `favicon.ico` (16/32/48), `icon.png` e `apple-icon.png` em `src/app`, pela convenção do Next. Falta conferir na aba do navegador depois do deploy (pode demorar por causa do cache).
- 2026-11-22: fontes Inter e Bodoni Moda carregadas de verdade com `next/font` (`src/app/fonts.ts`), em vez de cair na fonte do sistema. Build, tipos e testes ok; falta conferir no site depois do deploy.
- 2026-11-20: `CRON_SECRET` gerado de novo (o dono gravou o mesmo valor na Vercel e em `HOSPEDIN_CRON_SECRET` no GitHub) + redeploy. Disparo manual ok: 61 dias × 4 quartos; Superior mudou 2 dias; Térreo 20–21/11 tinha ajuste manual 1 (Hospedin 1 livre); a pedido do dono voltou ao automático (site 0).
- 2026-11-20: sincronização de disponibilidade passa a olhar 120 dias à frente (`?days=120` no workflow), porque o site vende Carnaval/março e, sem dado do Hospedin, considera o quarto todo livre. `CRON_SECRET` gerado de novo (mesmo valor na Vercel e em `HOSPEDIN_CRON_SECRET`) + redeploy.
- 2026-11-19: sincronização de disponibilidade com o Hospedin LIGADA. `HOSPEDIN_SYNC_ENABLED=true` na Vercel e no GitHub, `CRON_SECRET` trocado (o mesmo valor em `HOSPEDIN_CRON_SECRET` no GitHub), `HOSPEDIN_PASSWORD` atualizada, deploy feito. Primeira rodada ok (61 dias × 4 quartos) e GitHub Action a cada 30 min com sucesso. O site agora mostra livres do Hospedin − 1 (ex.: Superior 05/12 e 24/12 = 0; antes 2 fixos).

- 2026-11-18: validação de e-mail também no Villa (PR #10, `d02f592`) e no Refúgio (PR #12, `503af51`); conferido nos sites no ar.
- 2026-11-18: job `crm` removido do CI (PR #9, `cd7d441`).
- 2026-11-18: cron de expiração funcionando com o `CRON_SECRET`; as reservas PENDING de 07/11, 10/11 e 13/11 expiraram (`payment_deadline_passed`).
- 2026-11-18: validação de e-mail do hóspede em produção (PR #7, `485c632`); a API recusa `pepeke@pepeke`.
- 2026-11-14: colunas e tabelas do espelhamento criadas no Turso de produção (`ensure-sync-2026-11-schema.js`, conferido com novo dry-run sem pendências).
- 2026-11-14: `BOOKING_ACCESS_SECRET` e `CRON_SECRET` criados na Vercel (Production); `ENABLE_TEST_PAYMENTS` e `NEXT_PUBLIC_ENABLE_TEST_PAYMENTS` = `false` só em Production.
