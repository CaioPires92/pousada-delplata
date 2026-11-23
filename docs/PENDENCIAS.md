# Pendências do motor de reservas — Pousada Delplata

Tudo o que o código não resolve sozinho. Marque `[x]` ao concluir. Criado em 2026-11-21 a partir de `CLAUDE.md`, `AGENTS.md`, `README.md`, do `PENDENCIAS.md` da raiz, de `todo.md`, de `docs/ops/sync-motores-2026-11.md`, do git (log, branches, worktrees), de `package.json`, `vercel.json`, `.github/workflows/`, `.env.example`, do `npm audit --omit=dev` e de uma leitura do `src`. As seções abaixo guardam o histórico; **o que vale é o resumo**.

> **Não foi possível verificar nada que dependa de painel.** Vercel (variáveis, crons, deploys), Turso (banco de produção), Mercado Pago e Asaas (webhooks, chaves, pagamentos), Hospedin, Registro.br/DNS, provedor de e-mail, Search Console e Google Meu Negócio ficaram de fora: este levantamento foi feito só com o código, os documentos e o git local. Tudo que depende deles está marcado *(conferir)*. O `.env`, o `dev.db` e os backups não foram abertos.
>
> **Atualizado em 2026-11-23:** o levantamento abaixo foi feito em 2026-11-21 sobre a `main` em `0d466ee`. Depois disso o checkout local foi atualizado (`git rebase` sobre `origin/main` em `02b3735`), trazendo 11 commits do GitHub: o PR #21 (envio ao Hospedin, `e2f74e6`), o PR #23, o limite de 2 pets por reserva (`d62301e`), os ícones novos e o revert da barra de reserva. Os itens que esses commits resolveram já estão marcados; o resto do texto é de 2026-11-21 e pode ter envelhecido em outros pontos.

## Resumo atual (2026-11-21)

**Já está feito** (só o que o código, o git ou os documentos comprovam)

- Site e motor no ar em `https://www.pousadadelplata.com.br`; páginas públicas, `/reservar`, `/admin`, blog, termos, privacidade e política de cancelamento existem no código.
- Pagamento pelo **Mercado Pago Checkout Pro** (o Brick saiu no PR #6), com histórico de tentativas (`PaymentAttempt`), idempotência por tentativa, Device ID, motivos de recusa no admin e webhook endurecido (`src/app/api/webhooks/mercadopago/route.ts`). O webhook antigo (`/api/mercadopago/webhook`) responde 410 em produção.
- Prazo único de 60 min para pagar + 60 min de folga de bloqueio do quarto (`src/lib/booking-payment-window.ts`), expiração automática por cron e equipe avisada só na reserva confirmada.
- Desconto de 5% no Pix **removido** em 2026-11-18 (`e9f2a0e`), igualando Refúgio e Villa.
- Pagamento parcial (sinal de 50%) com registro no banco, no admin e nos e-mails (`todo.md`, seções 2 a 4).
- Promoções e cupons (construtor, acúmulo, público, selo, datas e dias excluídos, etiqueta própria do cupom) e busca unificada (datas, hóspedes, pets) na home, no widget e no `/reservar`.
- Sincronização de **estoque** com o Hospedin (API v2) ligada em 2026-11-19, olhando 120 dias à frente, por GitHub Actions a cada 30 min (`.github/workflows/hospedin-sync.yml`).
- **Envio de reservas ao Hospedin** (API v3) mesclado no `origin/main` pelo PR #21 (`e2f74e6`), no ar mas **desligado** (`HOSPEDIN_PUSH_ENABLED=false`).
- Validação real do e-mail do hóspede em produção (PR #7, `485c632`).
- Regras de lotação e crianças: idade obrigatória na busca, até 4 pagantes usando o estoque de 4 hóspedes do STD, 1 criança de 0 a 5 anos além da capacidade com aviso só nesse caso (PRs #18 e #20).
- Pets só de pequeno porte, R$ 20 por pet por diária, apenas em Térreo, Chalé e Anexo (`src/lib/pet-policy.ts`); o Superior é recusado com `pets_not_allowed`.
- Segurança do código: rotas de e-mail e de teste fechadas (`/api/test-email` dá 404 em produção e exige admin; `/api/emails/send-confirmation` exige token da reserva; tudo com limite de requisições), cron de expiração e cron do Hospedin recusam chamada sem `Authorization: Bearer <CRON_SECRET>` (401), `scripts/check-production-security.js` roda no build e derruba o deploy sem `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `ADMIN_JWT_SECRET`, `BOOKING_ACCESS_SECRET` ou com `ENABLE_TEST_PAYMENTS` diferente de `false`.
- Sem admin de exemplo no código: o admin é criado por `scripts/reservas/db/bootstrap-admin.ts`, que exige `ADMIN_BOOTSTRAP_SECRET`; não há seed de admin automático.
- Nenhum resquício textual de outra pousada no `src`/`public` (só um comentário citando o Refúgio em `src/lib/booking-payment-window.ts`) e nenhum `TODO`/`FIXME` no código.
- `sitemap.ts` e `robots.ts` existem; os metadados e as canônicas saem de `src/lib/seo.ts`, lendo `NEXT_PUBLIC_SITE_URL`.
- Quality gates no GitHub Actions (typecheck, mapa, reservas, interface) em todo PR e push na `main`; o build da Vercel roda `verify:production` (segurança + typecheck + testes) antes do `next build`.
- Scripts de backup lógico e de verificação do Turso prontos (`npm run db:backup:logical` / `db:backup:verify`).

**Falta (nesta ordem sugerida)**

1. **Entender por que as reservas não chegam ao pagamento** — nenhuma confirmação desde 2026-10-27 (seção 2).
2. **Ligar o envio de reservas ao Hospedin** (combinar a data de corte com a equipe) (seção 3).
3. **Atualizar o checkout local e mesclar as branches paradas** que já valem: `fix/migracao-occupied-units` e `chore/pendencias-pr21` (seções 12 e 3).
4. **Decidir a migração do pagamento para o Asaas** (branch `feat/migracao-asaas` parada desde 2026-11-13) (seção 1).
5. **Backup automático do Turso com destino persistente e teste de restauração** (seção 5).
6. **Dependências com vulnerabilidade** no `npm audit --omit=dev`: 12 (8 moderadas, 4 altas) (seção 6).
7. **Tirar do git os 16 backups de `dev.db`** versionados em `prisma/` (~160 MB, podem conter dados de hóspede) (seção 6).
8. **E-mail com domínio próprio** (hoje o padrão do código é `smtp.gmail.com`), com SPF, DKIM e DMARC (seção 7).
9. **Testes que dependem de credencial**: pagamento de ponta a ponta, reenvio do mesmo evento, link de pagamento do admin, e-mail de expirada, celular de verdade (seção 8).
10. **Teto do estoque de 4 hóspedes** ajustado à mão quarto por quarto e limite de pets por reserva (seção 9).
11. **Conteúdo e revisão dos textos pelo dono** (termos, privacidade, cancelamento) (seção 10).
12. **SEO e presença**: Search Console, canônicas no ar, links no Google Meu Negócio/Instagram/Booking, renovação do domínio (seção 11).
13. **Opcional:** Upstash para o limite de login do admin e as pendências abertas do `todo.md` (cupom de abandono, busca no admin) (seções 6 e 13).

## 1. Pagamento

Gateway em uso: **Mercado Pago**, Checkout Pro. O `.env.example` não tem nenhuma variável do Asaas e não existe `src/lib/asaas` na `main` — o código do Asaas só existe na branch.

- [ ] **Decidir a migração para o Asaas.** Branch `feat/migracao-asaas` (`e7fbf8c`, 2026-11-13), 4 commits à frente da `main`, com `src/lib/asaas/client.ts`, `src/lib/billing-address.ts` e testes. As outras três pousadas já foram (Refúgio) ou estão indo (Villa, com adaptador isolado em branch). Só mesclar quando o usuário disser "aplique".
- [ ] *(conferir)* Antes do merge do Asaas: conta aprovada, webhook de produção cadastrado e `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_ENVIRONMENT=production` na Vercel.
- [ ] O `PENDENCIAS.md` da raiz aponta um checklist em `docs/ativacao-asaas.md`, que **não existe na `main`** — está só na branch `feat/migracao-asaas`. Trazer o arquivo ou corrigir o apontamento.
- [ ] Depois de migrar: webhook em envio `NON_SEQUENTIALLY`; aceitar os eventos de parcela do cartão (`installmentNumber` com valor compatível com a divisão do total); tratar `PAYMENT_AWAITING_RISK_ANALYSIS` e `PAYMENT_REPROVED_BY_RISK_ANALYSIS`; mesmo token do webhook na Vercel e no Asaas; chave de sandbox rotacionada; produção sem sandbox liberado.
- [ ] *(conferir)* Webhook do Mercado Pago apontando para `https://www.pousadadelplata.com.br/api/webhooks/mercadopago` (o endpoint antigo `/api/mercadopago/webhook` responde 410 em produção, a menos que `ALLOW_LEGACY_MP_WEBHOOK=true`).
- [ ] *(conferir)* Auditoria de aprovação da conta do Mercado Pago (pendente de acesso desde `docs/ops/sync-motores-2026-11.md`).
- [ ] Enquanto o Mercado Pago estiver em uso, planejar a saída da dependência `mercadopago@2.x`: o `npm audit` só resolve a falha do `uuid` subindo para a 3.x (quebra). Se a migração ao Asaas acontecer, isso resolve junto.

## 2. Reservas que não chegam ao pagamento (investigar)

- Registro do `PENDENCIAS.md` da raiz: entre 2026-11-02 e 2026-11-13 foram 9 reservas criadas e **nenhuma** tentativa de pagamento no Mercado Pago (consultado por `external_reference`). A última confirmação é de 2026-10-27. Depois do PR #6 (2026-11-14), em 2026-11-16 houve 1 reserva de R$ 309 que abriu o Checkout Pro, não gerou tentativa no MP e expirou.
- [ ] *(conferir)* Ver no painel do Mercado Pago se voltaram a aparecer tentativas depois do Checkout Pro; se não, o problema está antes do gateway (link, redirecionamento ou desistência do hóspede).
- [ ] Fazer uma reserva de teste com cartão de verdade, de valor baixo, e conferir que vai ao Checkout Pro e volta confirmada (`npm run diag:payments` e `npm run diag:booking:last` ajudam a olhar o lado do banco).
- [ ] Olhar os alertas de dificuldade (`/api/notify-difficulty`) e os logs `opsLog` do período para ver em que passo o hóspede para.

## 3. Reserva do site → Hospedin (no ar, desligado)

PR #21 mesclado no `origin/main` (`e2f74e6`, 2026-11-20): reserva confirmada no site vira reserva no Hospedin pela API v3 (escolhe um quarto livre do tipo, cria o hóspede como "SITE - Nome", canal "Site" 222289, lança o valor pago em "Caixa Diário"/"Reserva"); cancelada, expirada ou estornada manda `POST /bookings/{id}/cancel`. Envio na confirmação e repescagem a cada 30 min no cron (`src/lib/hospedin-push.ts`). **Esse código não está no checkout local** — atualize antes de mexer.

- [ ] Combinar com a equipe a **data e hora de corte** (hoje a equipe lança as reservas do site à mão), gravar `HOSPEDIN_PUSH_SINCE` e `HOSPEDIN_PUSH_ENABLED=true` na Vercel e fazer um redeploy. *(conferir)*
- [ ] Acompanhar os logs `HOSPEDIN_PUSH_*` na primeira semana. Trava `pending:` parada = conferir no Hospedin se a reserva foi criada (o sistema não reenvia sozinho, para não duplicar). *(conferir)*
- [ ] Testar de verdade o **lançamento de pagamento** pela v3: a reserva de teste SI:020780 (2026-11-20) validou criação e cancelamento, mas não o lançamento financeiro.
- [ ] Mesclar a branch `chore/pendencias-pr21` (`435f94a`, 4 commits), que é o histórico dessa pendência no `PENDENCIAS.md` da raiz — hoje a seção 7 existe só lá. Enquanto não mesclar, o `PENDENCIAS.md` da `main` está incompleto.
- [ ] Depois: migrar a sincronização de **estoque** da v2 (e-mail e senha) para a v3 e avaliar gravar preços e restrições pela v3 (`PUT /prices`, `/restrictions`, `/closures`).
- Nota de estoque: reserva enviada deixa de contar no estoque geral do site (o Hospedin desconta), mas continua contando no estoque de 4 hóspedes, que só existe no site.

## 4. Crons e agendamento

- Hoje: `vercel.json` agenda só `/api/cron/cleanup-bookings` em `0 9 * * *` (uma vez por dia, limite do plano Hobby). A sincronização do Hospedin roda por GitHub Actions com `cron: '*/30 * * * *'`, mas o agendador do GitHub é por melhor esforço e, na prática, costuma rodar a cada 4 a 8 horas.
- [ ] Avaliar **cron da Vercel no plano Pro** (que aceita intervalo menor) ou um **agendador externo** chamando `/api/cron/hospedin-sync?days=120` e `/api/cron/cleanup-bookings` com `Authorization: Bearer <CRON_SECRET>`. Com o envio ao Hospedin ligado (seção 3), a repescagem de 30 min passa a importar de verdade.
- [ ] *(conferir)* `CRON_SECRET` na Vercel igual a `HOSPEDIN_CRON_SECRET` no GitHub (Settings > Secrets > Actions) e `HOSPEDIN_SYNC_ENABLED=true` nas duas pontas (o workflow só roda com a *variable* `HOSPEDIN_SYNC_ENABLED == 'true'`).
- [ ] *(conferir)* Chamar as duas rotas de cron **sem** o cabeçalho e confirmar 401 em produção (o código já faz isso; falta a evidência no ar).
- [ ] A expiração rodando só às 9h significa que uma reserva que vence às 10h segura o quarto até o dia seguinte. Avaliar frequência maior junto com o item acima.

## 5. Backup e recuperação do banco (Turso)

Os scripts existem (`scripts/reservas/db/backup-turso-logical.js` e `verify-logical-backup.js`), mas o destino é um `--output` passado na mão: não há agendamento nem lugar definido. O `.artifacts/` (onde ficam saídas locais) é ignorado pelo git.

- [ ] Definir um **destino persistente e privado** para os dumps (fora do repositório e fora do `.artifacts/`).
- [ ] **Automatizar** o backup (diário, pelo menos) e guardar mais de uma geração.
- [ ] **Testar a restauração** num banco Turso novo e vazio, conferindo a contagem de linhas com o `db:backup:verify`.
- [ ] Escrever o procedimento de recuperação (não existe `docs/production-recovery.md` neste projeto).
- [ ] *(conferir)* Se o plano do Turso tem retenção/point-in-time e por quanto tempo.

## 6. Segurança, dependências e limpeza do repositório

- [ ] **`npm audit --omit=dev` em 2026-11-21: 12 vulnerabilidades (8 moderadas, 4 altas).** As de correção simples (`npm audit fix`): `source-map-js` (alta), `zod` (alta, pede 4.6.6+). As que exigem versão maior: `mercadopago` (via `uuid`, subir para 3.x quebra) e `@sentry/nextjs` (minimatch; subir para 11.x quebra). Decidir caso a caso; a de `zod` e a de `source-map-js` dão para fazer já.
- [ ] **16 backups de `dev.db` versionados em `prisma/`** (`dev.db.backup-*`, de 0,7 MB a 11,6 MB, ~160 MB no histórico). São bancos SQLite completos de 2026-08; podem conter dados de hóspede e inflam o clone. Não foram abertos aqui. Decidir: tirar do índice (`git rm --cached`) e incluir no `.gitignore` (hoje `*.db` é ignorado, mas esses arquivos terminam em `.backup-...` e escapam do padrão). Limpar o histórico é outra conversa, mais invasiva.
- [ ] `webhook_debug.log` (3,3 KB, 2026-08) está na raiz do projeto. Não é versionado (`*.log` ignorado), mas vale apagar.
- [ ] *(conferir)* Na Vercel: `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` **removidas** (só o `bootstrap-admin.ts` local as usa) e `ADMIN_BOOTSTRAP_SECRET` presente só onde é preciso.
- [ ] *(conferir)* Admin real criado e nenhuma conta de teste ativa no banco de produção.
- [ ] *(conferir)* `ENABLE_TEST_PAYMENTS` e `NEXT_PUBLIC_ENABLE_TEST_PAYMENTS` em `false` em Production (o build falha se não estiverem, mas confirme também em Preview).
- [ ] *(conferir)* `ALLOW_LEGACY_MP_WEBHOOK` **não** definida em produção (ela reabre o webhook antigo).
- [ ] *(conferir)* Preview e Produção **não** compartilhando o mesmo banco Turso (uma reserva de teste no Preview viraria reserva real).
- [ ] **(Opcional) Upstash no limite de login do admin.** Hoje a contagem de 5 senhas erradas em 15 min fica na memória de cada servidor da Vercel: zera a cada reinício e não é compartilhada. Com `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` o limite passa a valer de verdade; o código já usa se existirem (`src/app/api/admin/login/route.ts`). Não é urgente com senha forte e única.
- [ ] Há vários arquivos de ambiente locais soltos (`.env.backup`, `.env.swp`, `.env.production.local`, `.env.production` vazio). Nenhum é versionado (conferido com `git ls-files`), mas convém reduzir a um só e apagar o resto da máquina.

## 7. E-mail

- O código cai em `smtp.gmail.com` quando `SMTP_HOST` não está definido e o remetente é sempre o `SMTP_USER` (`src/lib/email.ts`). O endereço de recepção padrão é `contato@pousadadelplata.com.br`, sobreposto por `CONTACT_RECEIVER_EMAIL`.
- [ ] *(conferir)* Qual provedor está em uso em produção e com que caixa.
- [ ] **SMTP no domínio próprio** (`@pousadadelplata.com.br`), com **SPF, DKIM e DMARC** no DNS. Sem isso os e-mails caem no spam.
- [ ] *(conferir)* `CONTACT_RECEIVER_EMAIL` apontando para a caixa que a recepção realmente lê.
- [x] Aviso à recepção só na reserva **confirmada** (já é assim desde o espelhamento do PR #6, `docs/ops/sync-motores-2026-11.md`).
- [ ] Abrir os e-mails de confirmação, de recuperação e de expiração no **Gmail e no Outlook** (só o HTML foi testado).

## 8. Testes que dependem de credenciais

- [ ] Pagamento de ponta a ponta com valor baixo: reservar no site → pagar → reserva vira Confirmada → e-mail chega ao hóspede e à recepção.
- [ ] Reenviar o mesmo evento pelo painel do gateway e conferir que **não duplica** confirmação nem e-mail (idempotência real).
- [ ] Gerar um **link de pagamento no admin** (`/api/admin/bookings/[bookingId]/payment-link`), pagar por ele e conferir a confirmação.
- [ ] E-mail de reserva **expirada** e de recuperação, no tempo certo.
- [ ] Fluxo de reserva **no celular de verdade** (não só no navegador headless): busca, hóspedes, cupom, pagamento.
- [ ] Reserva com **pet** e reserva com **4 pagantes** de ponta a ponta, conferindo o valor cobrado e o estoque que baixa.

## 9. Dados reais e regras de negócio

- [ ] **Teto do estoque de 4 hóspedes.** O Hospedin manda só a quantidade livre por tipo, sem o número do quarto, então o motor não sabe se o quarto livre é um dos que cabem 4. O estoque de 4 serve de teto e precisa ser ajustado **à mão** no mapa quando esses quartos forem ocupados por fora do site. Quartos que recebem 4 (levantados em 2026-11-20): Térreo 6 e 8, Superior 9 e 16, Chalés 23 e 24 → `HOSPEDIN_FOUR_GUEST_PLACE_IDS=20181,20183,20184,20191,20201,20202`. Teto pretendido: Térreo 2, Superior 2, Chalé 2, Anexo 0. Em 2026-11-20 estava **zerado em todos os quartos** em produção. *(conferir)*
- [x] 2026-11-23: **limite de pets por reserva** resolvido no `origin/main` pelo commit `d62301e`: `MAX_PETS_PER_BOOKING = 2` em `src/lib/pet-policy.ts`, aplicado na busca (`src/lib/booking-search.ts`). O levantamento de 2026-11-21 ainda dizia "até 10", de um checkout desatualizado.
- [ ] **Mínimo de noites em feriados.** O campo existe nas promoções/datas especiais (`minNights` em `src/constants/specialDates.ts` e `src/lib/promotions/*`); conferir se os feriados de 2027 (Carnaval, Páscoa, Natal, Réveillon) estão cadastrados no admin, já que o site já vende março. *(conferir)*
- [ ] *(conferir)* Tarifas, inventário e acomodações do banco de produção batendo com a realidade (o mapa é a fonte oficial, ver `docs/architecture/MAPA_SOURCE_OF_TRUTH.md`).
- [ ] **Preço direto x Booking.** Definir a regra (o combinado nas outras pousadas é o site sempre mais barato que o preço Genius do Booking); hoje não há nada no código que garanta isso.
- [x] Regras de crianças e ocupação definidas e no ar: idade obrigatória na busca, cobrança por faixa, até 4 pagantes no estoque de 4, 1 criança de 0 a 5 anos além da capacidade com aviso só nesse caso (PRs #18 e #20, 2026-11-20).

## 10. Conteúdo

- [ ] *(conferir)* **Termos e condições, política de privacidade e política de cancelamento lidas e aprovadas pelo dono.** As páginas existem (`src/app/termos-e-condicoes`, `politica-de-privacidade`, `politica-de-cancelamento`), mas não há registro de aprovação.
- [ ] *(conferir)* Fotos profissionais em todos os quartos e nas áreas comuns, e textos conferidos pelo dono.
- [ ] *(conferir)* Telefone, WhatsApp, endereço e e-mail iguais em site, Google Meu Negócio, Instagram e Booking. O rodapé publica `contato@pousadadelplata.com.br` e o Instagram `@pousadadelplata`.
- [x] Nenhum resquício de outra pousada no conteúdo: busca por "Villa Verona", "Refúgio Serrano" e "Pousada Paraíso" em `src` e `public` não achou nada (só um comentário de código citando o Refúgio em `src/lib/booking-payment-window.ts`). "Serra Negra" aparece muito porque é a cidade da própria Delplata.

## 11. Domínio e SEO

- [ ] *(conferir)* `NEXT_PUBLIC_SITE_URL` e `NEXT_PUBLIC_BASE_URL` apontando para `https://www.pousadadelplata.com.br` em Production (o `.env.example` traz `localhost:3005` e o código cai em `localhost:3001`; sem a variável, as canônicas, o sitemap e os links dos e-mails saem errados).
- [ ] *(conferir)* `sitemap.xml` e `robots.txt` respondendo no domínio e as canônicas apontando para o `www`.
- [ ] *(conferir)* **Search Console** com o domínio verificado e o sitemap enviado.
- [ ] *(conferir)* Link do site no **Google Meu Negócio**, no Instagram e na ficha do Booking.
- [ ] *(conferir)* **Renovação automática do domínio** ligada e contato de administração atual.
- [ ] Não há nenhum `redirects` em `next.config.ts`. Se existir endereço antigo (site anterior, `.vercel.app`, domínio sem `www`), criar os redirects 301 para não perder o que já é indexado.

## 12. Branches, worktrees e limpeza

Estado em 2026-11-21 (último `git fetch` em 2026-11-20 15:06; sem nada modificado no `git status` e sem stashes).

- [x] 2026-11-23: `git fetch` e rebase da `main` local sobre `origin/main` (`02b3735`) — o checkout deixou de estar atrasado.
- [ ] **`origin/fix/migracao-occupied-units`** (`254820b`, 1 commit): adiciona a migração que faltava de `InventoryAdjustment.occupiedUnits`. A coluna já existe no Turso de produção e no `schema.prisma`, mas sem essa migração **um banco local novo quebra no seed (P2022)**. Vale mesclar: é só um `ALTER TABLE` e não tem efeito em produção.
- [ ] **`origin/chore/pendencias-pr21`** (`435f94a`, 4 commits): histórico do envio ao Hospedin no `PENDENCIAS.md` da raiz (seção 3 deste arquivo).
- [ ] **`origin/feat/migracao-asaas`** (`e7fbf8c`, 4 commits): parada por decisão (seção 1).
- [ ] **`origin/docs/pendencia-upstash`** (`3214d58`, 1 commit): mexe no `SKILL.md` do karpathy, não no motor. Conferir se ainda interessa e apagar.
- [ ] **Branches `agent/*` abandonadas**, de julho de 2026, com 440 a 465 commits de diferença da `main`: `agent/booking-coupon-actions` (`934377a`, 2026-07-24, correção do Brick do Mercado Pago, que nem é mais usado), `agent/coupon-main-integration` (`67f09e2`, 2026-07-27) e `agent/crm-meta-foundation` (`97105a9`, 2026-07-23, CRM, cujo domínio foi removido na migração `20260901170000_remove_crm_domain`). Confirmar que nada delas é necessário e apagar as remotas.
- [ ] **Worktree antiga:** `.claude/worktrees/hospedin-reserva` está em `chore/pendencias-pr21` (`435f94a`), não na branch do nome, e tem um `.env` próprio. Remover com `git worktree remove` depois de resolver a branch.
- [ ] **Branches locais já mescladas** para apagar: `chore/remove-pix-discount-v2`, `ci/remove-crm-check`, `docs/pendencias-cron`, `fix/aviso-crianca-extra`, `fix/idade-e-4-hospedes`, `fix/validacao-email`, `sync/motor-villa-refugio`, `feat/hospedin-reserva`.
- [ ] Pastas locais de trabalho que não são versionadas e podem ir embora: `scratch/`, `.artifacts/`, `trash/`.

## 13. Alinhamento com as outras pousadas

O que as outras três já resolveram e vale avaliar aqui:

- [ ] **Do Refúgio Serrano:** pagamento só pelo Asaas, com webhook tratando parcelas do cartão (seção 1) e dependências atualizadas (seção 6). O prazo de 60 min + 60 min de folga, as rotas de e-mail fechadas e o aviso à equipe só na confirmada **já estão** aqui.
- [ ] **Da Pousada Paraíso:** mínimo de noites em feriados num lugar único (`src/constants/stay.ts` lá; aqui está espalhado entre `specialDates.ts` e as promoções) e **redirects de SEO** ao trocar de domínio (seção 11). Galerias com carrossel, expiração por cron e integração de ocupação com PMS externo **já estão** aqui.
- [ ] **Do Villa Verona:** o adaptador do Asaas isolado em branch é o mesmo caminho da seção 1; o backup sem destino persistente é a mesma pendência da seção 5 (dá para resolver uma vez e portar para as duas).
- [ ] **Pendências abertas do `todo.md` deste projeto**, ainda sem decisão: cupom de 5% por reserva abandonada (regra, validade, vínculo com e-mail/telefone, envio no e-mail de recuperação) e campo de busca por código/nome no painel de reservas.

## Limites para quem for executar (resumo do `CLAUDE.md` e do `AGENTS.md`)

- Antes de qualquer alteração, correção ou nova funcionalidade: **leia o `PENDENCIAS.md`** (o da raiz e este) e lembre o usuário, em poucas linhas no início da resposta, das pendências abertas — principalmente as que bloqueiam algo.
- Se o trabalho resolver ou criar uma pendência, **atualize o arquivo no mesmo commit**.
- **Não marque nada como concluído sem evidência** (git, código, documento ou verificação no ar).
- Este é o Next.js 16: as APIs e convenções podem não ser as do seu treino. Leia o guia pertinente em `node_modules/next/dist/docs/` antes de escrever código e respeite os avisos de depreciação. O bloco `nextjs-agent-rules` do `AGENTS.md` é reescrito pelo `next dev`; se aparecer no diff, comite junto.
