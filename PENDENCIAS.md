# Pendências — Pousada Delplata

**Esta é a única lista de pendências do repositório.** Os agentes (Claude Code e Codex) leem este arquivo a cada pedido de alteração e lembram o que está aberto (ver `CLAUDE.md` e `AGENTS.md`). Em 2026-11-27 ela absorveu o antigo `docs/PENDENCIAS.md` (backlog do motor, levantamento de 2026-11-21) e o antigo `todo.md` (melhorias do fluxo de pagamento); os originais ficam em `docs/root-legacy/` com o texto completo.

Como ler:
- **Abertas (1 a 8):** o que está em andamento agora, com o contexto mais recente (site, novo layout, motor, Hospedin).
- **Backlog do motor e da operação (B1 a B13):** o levantamento de 2026-11-21: pagamento, crons, backup, segurança, e-mail, testes, domínio e SEO, branches. Os temas que repetem os itens 2, 3, 4, 5 e 6 acima valem pelo item numerado (mais recente).
- **Fluxo de pagamento (C1 a C5):** o que sobrou do `todo.md`.
- **Concluídas:** por data.
- **Fora deste repositório:** o painel visual "Backlog da Delplata" (artefato do Claude) e `auditorias/delplata/PENDENCIAS.md` tratam de **canais e preço** (Booking, Expedia, Airbnb, comissões, tarifário 2027, desmembrar Chalés e Anexos). Dados financeiros ficam lá e **não entram neste arquivo**.

Como manter:
- Marque `[x]` e escreva a data quando concluir; mova para **Concluídas** na próxima edição. Não marque nada como concluído sem evidência (código, git, documento ou verificação no ar).
- Pendência nova: inclua o contexto (branch, arquivo, por quê) para dar para retomar sem precisar da conversa.
- Datas no formato AAAA-MM-DD.
- Não crie outra lista: acrescente aqui. Quando o painel visual precisar mudar, peça para republicá-lo a partir deste arquivo.

## Abertas

### 1. Espelhamento do motor: conferir depois do merge
- PR #6 mesclado em 2026-11-14 (`a7909d5`), deploy de produção Ready. A busca responde em produção e, com pets, só oferece Térreo, Chalé e Anexo.
- [ ] Fazer uma reserva de teste com cartão e conferir que vai para o Checkout Pro e volta confirmada.
- [ ] Conferir no painel do Mercado Pago que o webhook aponta para `https://www.pousadadelplata.com.br/api/webhooks/mercadopago`.

### 2. Reservas que não chegam ao pagamento (investigar)
- 2026-11-18: desde o deploy (2026-11-14) houve 1 reserva (2026-11-16, R$ 309). Ela abriu o Checkout Pro, mas não houve nenhuma tentativa no MP e a reserva expirou. Ainda não há confirmações desde 2026-10-27.
- Entre 2026-11-02 e 2026-11-13 foram 9 reservas criadas e nenhuma tentativa de pagamento no Mercado Pago (consultado por `external_reference`). O último pagamento é de 2026-10-27.
- O PR #6 troca o Brick pelo Checkout Pro. Depois do merge, ver se as tentativas voltam a aparecer.
- 2026-11-22: varredura da API pública (2 adultos, 2 noites, próximos 90 dias): 21 de 90 datas sem nenhum quarto e 6 com mínimo de 3 a 4 noites; para 4 adultos, **90 de 90 sem quarto** (estoque de 4 zerado). Pode ser parte do motivo das poucas reservas (famílias de 4 não conseguem reservar).

### 3. Migração do pagamento para o Asaas (branch parada)
- Branch: `feat/migracao-asaas`, criada em 2026-11-13 a partir da branch do espelhamento. Checklist em `docs/ativacao-asaas.md`.
- Só mesclar quando o usuário disser "aplique". Antes disso: conta Asaas aprovada, webhook configurado e `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_ENVIRONMENT=production` na Vercel.
- Depois do merge, esperar uns 120 dias para remover o código do Mercado Pago.

### 4. (Opcional) Upstash para o limite de login do admin
- Hoje o login bloqueia após 5 senhas erradas em 15 min, mas a contagem fica na memória de cada servidor da Vercel (zera ao reiniciar e não é compartilhada). Com Upstash, o limite vale de verdade.
- Não é urgente se a senha do admin for forte e única. Para ativar: conta gratuita no Upstash e `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` na Vercel (Production). O código já usa se existirem (`src/app/api/admin/login/route.ts`).

### 5. Estoque de 4 hóspedes antes de mesclar o PR de 4 pagantes
- Branch `fix/idade-e-4-hospedes` (2026-11-20): a busca passa a aceitar até 4 pagantes (adultos e crianças de 6 a 11) e a reserva usa o estoque de 4 hóspedes do quarto, que é um pedaço do estoque do STD (reserva de 4 baixa os dois; STD lotado fecha a de 4).
- 2026-11-20: estoque de 4 zerado em produção em todos os quartos (antes 2 no Térreo, no Chalé e no Superior), conferido na API pública. O usuário abre dia a dia no mapa.
- 1 criança de 0 a 5 anos pode ficar além da capacidade do quarto usado (STD = 3 até 3 pagantes; quarto de 4 com 4 pagantes). O aviso "Criança de até 5 anos é cortesia, sem cama extra." só aparece nesse caso (ajuste pedido pelo usuário em 2026-11-20).
- Limite: o Hospedin manda só a quantidade livre por tipo, sem o número do quarto. O motor não sabe se o quarto livre é um dos que cabem 4; o estoque de 4 serve de teto e precisa ser ajustado na mão quando os quartos de 4 forem ocupados por fora do site.

### 6. Reserva do site → Hospedin (código pronto, desligado)
- Branch `feat/hospedin-reserva` (2026-11-20), usando a API v3 do Hospedin (Client ID + Secret; doc em `https://pms.hospedin.com/api-docs/v3/swagger.yaml`). Reserva confirmada no site → o site escolhe um quarto livre do tipo (a v3 exige o quarto), cria o hóspede como "SITE - Nome", cria a reserva no canal "Site" (222289) com o total das diárias e lança o valor pago (conta "Caixa Diário", categoria "Reserva"). Observação leva todos os detalhes (contato, idades, pets, promoção, cupom, total, pagamento, saldo e prazo). Nunca troca o tipo de quarto reservado. Cancelada/expirada/estornada no site → `POST /bookings/{id}/cancel`. Envio na hora da confirmação e, para o que escapar, a cada 30 min no cron do Hospedin (`src/lib/hospedin-push.ts`).
- Desligado até `HOSPEDIN_PUSH_ENABLED=true` + `HOSPEDIN_PUSH_SINCE` + `HOSPEDIN_SITE_SALE_CHANNEL_ID` + `HOSPEDIN_CLIENT_ID`/`HOSPEDIN_CLIENT_SECRET` na Vercel. A data de corte existe porque a equipe já lança as reservas do site à mão: depois de ligar, ela para de lançar as novas.
- [x] 2026-11-20: login na v3 e leitura conferidos (conta 906, 10 canais, 5 tipos e 33 quartos, disponibilidade por quarto).
- [x] 2026-11-20: reserva de teste SI:020780 criada pela v3 (Chalé 28, 15→16/06/2027, canal Site, R$ 1,00), conferida no painel pelo usuário e cancelada pela API; o quarto voltou a ficar livre. O hóspede de teste não pode ser apagado (tem histórico) e foi desativado. O lançamento de pagamento ainda não foi testado de verdade.
- [x] 2026-11-20: quartos que recebem 4: Térreo 6 e 8, Superior 9 e 16 (casal + beliche) e Chalés 23 e 24 (casal + solteiro, recebem 4 segundo o usuário) → `HOSPEDIN_FOUR_GUEST_PLACE_IDS=20181,20183,20184,20191,20201,20202`. Teto do estoque de 4 no site: Térreo 2, Superior 2, Chalé 2, Anexo 0 (pendência 5).
- [x] 2026-11-20: PR #21 aberto; na Vercel (Production) já estão `HOSPEDIN_CLIENT_ID`, `HOSPEDIN_CLIENT_SECRET`, `HOSPEDIN_SITE_SALE_CHANNEL_ID=222289`, `HOSPEDIN_FOUR_GUEST_PLACE_IDS` e `HOSPEDIN_PUSH_ENABLED=false`.
- [x] 2026-11-20: PR #21 mesclado (`e2f74e6`) e deploy de produção Ready; o site e a cotação respondem, envio ao Hospedin no ar mas desligado.
- [ ] Combinar com a equipe a data e hora de corte, pôr `HOSPEDIN_PUSH_SINCE` e `HOSPEDIN_PUSH_ENABLED=true` na Vercel e fazer um redeploy.
- Depois: migrar a sincronização de estoque da v2 (e-mail e senha) para a v3 e avaliar gravar preços/restrições pela v3 (`PUT /prices`, `/restrictions`, `/closures`).
- [ ] Ligar na Vercel e acompanhar os logs `HOSPEDIN_PUSH_*` na primeira semana. Trava `pending:` parada = conferir no Hospedin se a reserva foi criada (o sistema não reenvia sozinho para não duplicar).
- Estoque: reserva enviada deixa de contar no estoque geral do site (o Hospedin já desconta), mas continua contando no estoque de 4 hóspedes, que só existe no site.

### 7. Check-in online por WhatsApp (admin) — conferir em produção
- Branch `feat/checkin-online-whatsapp` (2026-11-23). Página `/admin/checkin-online` (item "Check-in online" no menu): lista as UHs com check-in no período (padrão hoje + 7 dias) lidas do Hospedin pela API v3 (somente leitura) e, para cada uma, abre o WhatsApp (`wa.me`) com a mensagem e o `check_in_online_url` prontos. Independente do motor e da pendência 6: lê todas as reservas da conta, inclusive as lançadas à mão. Código em `src/lib/hospedin-checkin.ts`, `src/lib/checkin-whatsapp.ts` e `src/app/api/admin/checkin-online/route.ts`.
- 2026-11-24: testado pelo usuário no preview da branch (variáveis `HOSPEDIN_CLIENT_ID`, `HOSPEDIN_CLIENT_SECRET` e `HOSPEDIN_BASE_URL` liberadas também para Preview na Vercel) e funcionou. Decisão do usuário: a ferramenta fica no site (não vai virar app separado). PR #25 mesclado na `main`.
- [ ] Conferir em produção (`https://www.pousadadelplata.com.br/admin/checkin-online`, logado no admin) depois do deploy: telefones, links do check-in e reservas batem com o Hospedin.
- "Enviado" fica só no navegador de quem clicou (localStorage); duas pessoas usando podem mandar duas vezes. Se isso incomodar, guardar no banco (exige coluna/tabela nova no Turso).

### 8. Novo layout do site — no ar desde 2026-11-26 (PR #24): conferir em produção
- PR #24 (`feat/novo-layout-paraiso`, 71 commits) mesclado na `main` em 2026-11-26 (`29e0cf7`), junto com a `main` que já tinha a política de cancelamento real e o check-in online. O PR #27 corrigiu o teste do `SearchWidget` que dependia da data e derrubava o build da Vercel (o build roda a suíte de testes). Design em `docs/design-system-delplata.md` (direção expressiva, decidida pelo dono em 2026-11-23); referências em `docs/referencias-pousadas.md`.
- Feito e verificado por captura de tela no preview (25 e 26/11/2026): home, acomodações (painéis por ala, páginas dos quartos, submenu), lazer, restaurante, contato, blog, políticas, navbar, `/reservar` (etapas 1 a 3) e confirmação. Acessibilidade medida com axe (WCAG A/AA): 0 violações nas páginas testadas. Testes: 880 de 880 no PR.
- Deploy de produção da `main` (`0384149`, merge do PR #28) conferido no painel da Vercel em 2026-11-27: **Ready** (1m36s). Falta só a conferência visual abaixo.
- [ ] Conferir no site de produção (`pousadadelplata.com.br`, Ctrl+F5) (o deploy já está Ready), principalmente `/acomodacoes` e as páginas dos quartos (dependem do banco e não foram vistas com dados reais fora do preview) e a política de cancelamento.
- [ ] Reserva de teste até o pagamento: o formulário de cartão/Pix do próprio Mercado Pago não foi visto (não se chama o Mercado Pago real nos testes). Na confirmação "não aprovada", o selo "Status da reserva" mostra "Cancelada" enquanto o título diz "Não confirmada": olhar com uma reserva real.
- [ ] Térreo (e qualquer quarto) sem vaga na data da busca agora aparece no painel da home com a etiqueta "Indisponível hoje" e a próxima data com vaga (a home consulta `/api/rooms` e depois `/api/availability` data a data, até 30 dias à frente, de 5 em 5). Conferir em produção e acompanhar se essas consultas pesam no banco; se pesarem, trocar por uma rota única no servidor.
- [ ] Datas de Réveillon (30/12/2026 a 02/01/2027) e Carnaval (06/02 a 10/02/2027): cadastradas com datas padrão do calendário (sem estadia mínima); confirmar. Fotos: Carnaval = decoração real da pousada (Drive, 09/Carnaval, IMG_0480, salva em `public/fotos/decoracao-sazonal/`); Réveillon = caipirinha à beira da piscina (`bar-principal/porcoes/DSC_0312`), provisória, porque não há foto de virada de ano; Natal = foto do café da manhã. A pasta sazonal do Drive (e o `_indice.csv` dela) só tem Carnaval e Páscoa (54 fotos de Páscoa, sem uso). Falta uma foto de Natal da própria pousada e, se quiser, uma de Réveillon mais festiva.
- [ ] Fotos do apartamento Superior: só há 7 de boa luz (a série 0F5A do Drive é escura e foi descartada). Refazer a sessão (luz natural, cortinas abertas), principalmente uma foto "sem beliche" sem decoração (a DSC_0058 tem a decoração romântica). Térreo sem janela: hoje 6 fotos; conferir se as IMG_0131, 0133 e a do banheiro (pasta `sem-janelas`) são mesmo do Térreo.
- [ ] Legendas das galerias dos quartos (`src/lib/room-gallery.ts`, valem na página do quarto e na home): confirmar com a equipe que o Térreo é atribuído conforme a disponibilidade (pode-se pedir preferência pelo WhatsApp) e que "a maioria sem janela, poucas com janela" está certo. A galeria por áreas da home ("Piscina do hotel" x "Piscina dos chalés", churrasqueiras, jardins, barzinho, sala de TV, café) foi montada pelo nome das pastas e pelas imagens: conferir.
- [ ] Decoração romântica (R$ 80: pétalas de rosas artificiais, toalhas em cisne, espumante e caixa de bombom; qualquer quarto): seção na home (`RomanticSection`) e cartão em cada página de acomodação, configurados em `src/constants/romanticDecor.ts`. Texto, valor e itens confirmados pelo usuário em 2026-11-25 (pedido pelo WhatsApp, combinado antes da chegada, fora do valor da reserva no site). Falta foto da decoração em outro quarto, quando houver.
- [ ] Mídia (Drive, pasta 1wfmQg08Jml0rjQGPl41f_PAC8QnX0sjy): catalogada (725 itens úteis; de fora ficam pets, RAW, a decoração sazonal que não for usada e "06/Bar/nao postar"). Vídeos gravados na vertical (9:16), tremidos e com 1080 px: dois clipes foram testados no topo da home e o usuário reprovou; o topo voltou à foto e o código de vídeo foi removido. Só vale tentar de novo com gravação nova (horizontal, 4K, tripé ou estabilizador). Cerca de 20 clipes mostram cachorro e não devem ser usados.
- [ ] Agenda de Serra Negra no blog: as datas da Parada de Natal NÃO estão publicadas, porque as fontes divergem (reportagem de 27/10/2026: 12, 17, 19, 23, 25 e 27/12; página da Prefeitura, só pelo resumo da busca: 17, 18, 22, 25, 28 e 29/12, ano incerto). O site mostra só um aviso com link para a página oficial. O site da Prefeitura bloqueia leitura automática (403): alguém precisa abrir e confirmar as datas e o ano, e atualizar o texto do artigo do Natal. Réveillon e a agenda do Visite de 13 a 31/12 também não puderam ser lidos.
- [ ] Rotina semanal "Agenda de Serra Negra" (segunda, 07h17 de Brasília; começa em 2026-11-30): pesquisa o Visite Serra Negra, a Prefeitura e a imprensa, atualiza `src/data/agenda-serra-negra.ts` e entrega um PR em rascunho para revisão (nada é publicado sozinho). Como roda sem as ferramentas do GitHub, pode só enviar a branch e deixar o texto do PR na resposta. Conferir a primeira execução e mesclar ou revisar toda semana. Para pausar ou apagar, usar as tarefas agendadas.
- [ ] Fotos de terceiros no blog (parada de Natal, Prefeitura): o usuário quer usar com a fonte indicada. O site da Prefeitura bloqueia leitura automática e isso não foi contornado, então as fotos não foram baixadas. O blog já aceita crédito (`credit: { text, href }`); falta alguém salvar as fotos (Drive ou `public/fotos/blog/`) e informar o crédito. Crédito não substitui licença: o ideal é pedir autorização à assessoria de comunicação da Prefeitura.
- [ ] SEO: o sitemap foi enviado no Search Console em 2026-11-24. Por volta de **2026-12-02**, abrir Search Console → Indexação → Páginas e conferir quantas das 20 URLs foram indexadas; nas que ficarem de fora, Inspecionar URL → Solicitar indexação. **Não apagar o TXT `google-site-verification` da zona DNS na Hostinger**, senão a verificação cai. O h1 da home já vem no HTML do servidor.
- [ ] Ainda não feito: selo de reserva direta com benefício real, preço "a partir de" por acomodação, botão fixo de reservar, WhatsApp com datas, página de feriados/pacotes com preço, depoimentos reais, vídeo/tour 360, Páscoa na lista de feriados (datas a confirmar: Páscoa de 2027 cai em 28/03).
- Hospedagem e pagamento não foram tocados pelo novo layout. Em `/reservar` mudou só a apresentação; lógica de reserva, preço, cupom e pagamento intactas.

## Backlog do motor e da operação (levantamento de 2026-11-21, atualizado em 2026-11-23)

Origem: o antigo `docs/PENDENCIAS.md` (texto completo preservado em `docs/root-legacy/PENDENCIAS-motor-2026-11-21.md`), feito a partir de `CLAUDE.md`, `AGENTS.md`, `README.md`, `todo.md`, `docs/ops/sync-motores-2026-11.md`, do git, de `package.json`, `vercel.json`, `.github/workflows/`, `.env.example`, do `npm audit --omit=dev` e de uma leitura do `src`. As seções B1 a B13 guardam o histórico; **o que vale é o resumo**, mas ele é de 2026-11-21 e pode ter envelhecido (os itens 1 a 8 acima são mais recentes).

> **Não foi possível verificar nada que dependa de painel.** Vercel (variáveis, crons, deploys), Turso (banco de produção), Mercado Pago e Asaas (webhooks, chaves, pagamentos), Hospedin, Registro.br/DNS, provedor de e-mail, Search Console e Google Meu Negócio ficaram de fora: o levantamento usou só o código, os documentos e o git local. Tudo que depende deles está marcado *(conferir)*. O `.env`, o `dev.db` e os backups não foram abertos.
>
> **Já resolvido desde o levantamento:** o PR #21 (envio ao Hospedin, `e2f74e6`), o limite de 2 pets por reserva (`d62301e`) e, em 2026-11-26, o novo layout do site (PR #24) e a correção do teste que derrubava o build (PR #27).

### Resumo do levantamento (2026-11-21)

**Já está feito** (só o que o código, o git ou os documentos comprovam)

- Site e motor no ar em `https://www.pousadadelplata.com.br`; páginas públicas, `/reservar`, `/admin`, blog, termos, privacidade e política de cancelamento existem no código.
- Pagamento pelo **Mercado Pago Checkout Pro** (o Brick saiu no PR #6), com histórico de tentativas (`PaymentAttempt`), idempotência por tentativa, Device ID, motivos de recusa no admin e webhook endurecido (`src/app/api/webhooks/mercadopago/route.ts`). O webhook antigo (`/api/mercadopago/webhook`) responde 410 em produção.
- Prazo único de 60 min para pagar + 60 min de folga de bloqueio do quarto (`src/lib/booking-payment-window.ts`), expiração automática por cron e equipe avisada só na reserva confirmada.
- Desconto de 5% no Pix **removido** em 2026-11-18 (`e9f2a0e`), igualando Refúgio e Villa.
- Pagamento parcial (sinal de 50%) com registro no banco, no admin e nos e-mails (antigo `todo.md`, seções 2 a 4, em `docs/root-legacy/todo-fluxo-pagamentos.md`).
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

1. **Entender por que as reservas não chegam ao pagamento** — nenhuma confirmação desde 2026-10-27 (B2).
2. **Ligar o envio de reservas ao Hospedin** (combinar a data de corte com a equipe) (B3).
3. **Atualizar o checkout local e mesclar as branches paradas** que já valem: `fix/migracao-occupied-units` e `chore/pendencias-pr21` (B12 e B3).
4. **Decidir a migração do pagamento para o Asaas** (branch `feat/migracao-asaas` parada desde 2026-11-13) (B1).
5. **Backup automático do Turso com destino persistente e teste de restauração** (B5).
6. **Dependências com vulnerabilidade** no `npm audit --omit=dev`: 12 (8 moderadas, 4 altas) (B6).
7. **Tirar do git os 16 backups de `dev.db`** versionados em `prisma/` (~160 MB, podem conter dados de hóspede) (B6).
8. **E-mail com domínio próprio** (hoje o padrão do código é `smtp.gmail.com`), com SPF, DKIM e DMARC (B7).
9. **Testes que dependem de credencial**: pagamento de ponta a ponta, reenvio do mesmo evento, link de pagamento do admin, e-mail de expirada, celular de verdade (B8).
10. **Teto do estoque de 4 hóspedes** ajustado à mão quarto por quarto e limite de pets por reserva (B9).
11. **Conteúdo e revisão dos textos pelo dono** (termos, privacidade, cancelamento) (B10).
12. **SEO e presença**: Search Console, canônicas no ar, links no Google Meu Negócio/Instagram/Booking, renovação do domínio (B11).
13. **Opcional:** Upstash para o limite de login do admin e as melhorias abertas do antigo `todo.md` (cupom de abandono, busca no admin; agora em C1 a C5) (B6 e B13).

### B1. Pagamento

Gateway em uso: **Mercado Pago**, Checkout Pro. O `.env.example` não tem nenhuma variável do Asaas e não existe `src/lib/asaas` na `main` — o código do Asaas só existe na branch.

- [ ] **Decidir a migração para o Asaas.** Branch `feat/migracao-asaas` (`e7fbf8c`, 2026-11-13), 4 commits à frente da `main`, com `src/lib/asaas/client.ts`, `src/lib/billing-address.ts` e testes. As outras três pousadas já foram (Refúgio) ou estão indo (Villa, com adaptador isolado em branch). Só mesclar quando o usuário disser "aplique".
- [ ] *(conferir)* Antes do merge do Asaas: conta aprovada, webhook de produção cadastrado e `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_ENVIRONMENT=production` na Vercel.
- [ ] O `PENDENCIAS.md` da raiz aponta um checklist em `docs/ativacao-asaas.md`, que **não existe na `main`** — está só na branch `feat/migracao-asaas`. Trazer o arquivo ou corrigir o apontamento.
- [ ] Depois de migrar: webhook em envio `NON_SEQUENTIALLY`; aceitar os eventos de parcela do cartão (`installmentNumber` com valor compatível com a divisão do total); tratar `PAYMENT_AWAITING_RISK_ANALYSIS` e `PAYMENT_REPROVED_BY_RISK_ANALYSIS`; mesmo token do webhook na Vercel e no Asaas; chave de sandbox rotacionada; produção sem sandbox liberado.
- [ ] *(conferir)* Webhook do Mercado Pago apontando para `https://www.pousadadelplata.com.br/api/webhooks/mercadopago` (o endpoint antigo `/api/mercadopago/webhook` responde 410 em produção, a menos que `ALLOW_LEGACY_MP_WEBHOOK=true`).
- [ ] *(conferir)* Auditoria de aprovação da conta do Mercado Pago (pendente de acesso desde `docs/ops/sync-motores-2026-11.md`).
- [ ] Enquanto o Mercado Pago estiver em uso, planejar a saída da dependência `mercadopago@2.x`: o `npm audit` só resolve a falha do `uuid` subindo para a 3.x (quebra). Se a migração ao Asaas acontecer, isso resolve junto.

### B2. Reservas que não chegam ao pagamento (investigar)

- Registro do `PENDENCIAS.md` da raiz: entre 2026-11-02 e 2026-11-13 foram 9 reservas criadas e **nenhuma** tentativa de pagamento no Mercado Pago (consultado por `external_reference`). A última confirmação é de 2026-10-27. Depois do PR #6 (2026-11-14), em 2026-11-16 houve 1 reserva de R$ 309 que abriu o Checkout Pro, não gerou tentativa no MP e expirou.
- [ ] *(conferir)* Ver no painel do Mercado Pago se voltaram a aparecer tentativas depois do Checkout Pro; se não, o problema está antes do gateway (link, redirecionamento ou desistência do hóspede).
- [ ] Fazer uma reserva de teste com cartão de verdade, de valor baixo, e conferir que vai ao Checkout Pro e volta confirmada (`npm run diag:payments` e `npm run diag:booking:last` ajudam a olhar o lado do banco).
- [ ] Olhar os alertas de dificuldade (`/api/notify-difficulty`) e os logs `opsLog` do período para ver em que passo o hóspede para.

### B3. Reserva do site → Hospedin (no ar, desligado)

PR #21 mesclado no `origin/main` (`e2f74e6`, 2026-11-20): reserva confirmada no site vira reserva no Hospedin pela API v3 (escolhe um quarto livre do tipo, cria o hóspede como "SITE - Nome", canal "Site" 222289, lança o valor pago em "Caixa Diário"/"Reserva"); cancelada, expirada ou estornada manda `POST /bookings/{id}/cancel`. Envio na confirmação e repescagem a cada 30 min no cron (`src/lib/hospedin-push.ts`). **Esse código não está no checkout local** — atualize antes de mexer.

- [ ] Combinar com a equipe a **data e hora de corte** (hoje a equipe lança as reservas do site à mão), gravar `HOSPEDIN_PUSH_SINCE` e `HOSPEDIN_PUSH_ENABLED=true` na Vercel e fazer um redeploy. *(conferir)*
- [ ] Acompanhar os logs `HOSPEDIN_PUSH_*` na primeira semana. Trava `pending:` parada = conferir no Hospedin se a reserva foi criada (o sistema não reenvia sozinho, para não duplicar). *(conferir)*
- [ ] Testar de verdade o **lançamento de pagamento** pela v3: a reserva de teste SI:020780 (2026-11-20) validou criação e cancelamento, mas não o lançamento financeiro.
- [ ] Branch `chore/pendencias-pr21` (`435f94a`, 4 commits): era o histórico dessa pendência no `PENDENCIAS.md` da raiz. O item 6 acima já traz esse histórico na `main`; conferir se a branch ainda tem algo a mais e, se não, apagá-la.
- [ ] Depois: migrar a sincronização de **estoque** da v2 (e-mail e senha) para a v3 e avaliar gravar preços e restrições pela v3 (`PUT /prices`, `/restrictions`, `/closures`).
- Nota de estoque: reserva enviada deixa de contar no estoque geral do site (o Hospedin desconta), mas continua contando no estoque de 4 hóspedes, que só existe no site.

### B4. Crons e agendamento

- Hoje: `vercel.json` agenda só `/api/cron/cleanup-bookings` em `0 9 * * *` (uma vez por dia, limite do plano Hobby). A sincronização do Hospedin roda por GitHub Actions com `cron: '*/30 * * * *'`, mas o agendador do GitHub é por melhor esforço e, na prática, costuma rodar a cada 4 a 8 horas.
- [ ] Avaliar **cron da Vercel no plano Pro** (que aceita intervalo menor) ou um **agendador externo** chamando `/api/cron/hospedin-sync?days=120` e `/api/cron/cleanup-bookings` com `Authorization: Bearer <CRON_SECRET>`. Com o envio ao Hospedin ligado (B3), a repescagem de 30 min passa a importar de verdade.
- [ ] *(conferir)* `CRON_SECRET` na Vercel igual a `HOSPEDIN_CRON_SECRET` no GitHub (Settings > Secrets > Actions) e `HOSPEDIN_SYNC_ENABLED=true` nas duas pontas (o workflow só roda com a *variable* `HOSPEDIN_SYNC_ENABLED == 'true'`).
- [ ] *(conferir)* Chamar as duas rotas de cron **sem** o cabeçalho e confirmar 401 em produção (o código já faz isso; falta a evidência no ar).
- [ ] A expiração rodando só às 9h significa que uma reserva que vence às 10h segura o quarto até o dia seguinte. Avaliar frequência maior junto com o item acima.

### B5. Backup e recuperação do banco (Turso)

Os scripts existem (`scripts/reservas/db/backup-turso-logical.js` e `verify-logical-backup.js`), mas o destino é um `--output` passado na mão: não há agendamento nem lugar definido. O `.artifacts/` (onde ficam saídas locais) é ignorado pelo git.

- [ ] Definir um **destino persistente e privado** para os dumps (fora do repositório e fora do `.artifacts/`).
- [ ] **Automatizar** o backup (diário, pelo menos) e guardar mais de uma geração.
- [ ] **Testar a restauração** num banco Turso novo e vazio, conferindo a contagem de linhas com o `db:backup:verify`.
- [ ] Escrever o procedimento de recuperação (não existe `docs/production-recovery.md` neste projeto).
- [ ] *(conferir)* Se o plano do Turso tem retenção/point-in-time e por quanto tempo.

### B6. Segurança, dependências e limpeza do repositório

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

### B7. E-mail

- O código cai em `smtp.gmail.com` quando `SMTP_HOST` não está definido e o remetente é sempre o `SMTP_USER` (`src/lib/email.ts`). O endereço de recepção padrão é `contato@pousadadelplata.com.br`, sobreposto por `CONTACT_RECEIVER_EMAIL`.
- [ ] *(conferir)* Qual provedor está em uso em produção e com que caixa.
- [ ] **SMTP no domínio próprio** (`@pousadadelplata.com.br`), com **SPF, DKIM e DMARC** no DNS. Sem isso os e-mails caem no spam.
- [ ] *(conferir)* `CONTACT_RECEIVER_EMAIL` apontando para a caixa que a recepção realmente lê.
- [x] Aviso à recepção só na reserva **confirmada** (já é assim desde o espelhamento do PR #6, `docs/ops/sync-motores-2026-11.md`).
- [ ] Abrir os e-mails de confirmação, de recuperação e de expiração no **Gmail e no Outlook** (só o HTML foi testado).

### B8. Testes que dependem de credenciais

- [ ] Pagamento de ponta a ponta com valor baixo: reservar no site → pagar → reserva vira Confirmada → e-mail chega ao hóspede e à recepção.
- [ ] Reenviar o mesmo evento pelo painel do gateway e conferir que **não duplica** confirmação nem e-mail (idempotência real).
- [ ] Gerar um **link de pagamento no admin** (`/api/admin/bookings/[bookingId]/payment-link`), pagar por ele e conferir a confirmação.
- [ ] E-mail de reserva **expirada** e de recuperação, no tempo certo.
- [ ] Fluxo de reserva **no celular de verdade** (não só no navegador headless): busca, hóspedes, cupom, pagamento.
- [ ] Reserva com **pet** e reserva com **4 pagantes** de ponta a ponta, conferindo o valor cobrado e o estoque que baixa.

### B9. Dados reais e regras de negócio

- [ ] **Teto do estoque de 4 hóspedes.** O Hospedin manda só a quantidade livre por tipo, sem o número do quarto, então o motor não sabe se o quarto livre é um dos que cabem 4. O estoque de 4 serve de teto e precisa ser ajustado **à mão** no mapa quando esses quartos forem ocupados por fora do site. Quartos que recebem 4 (levantados em 2026-11-20): Térreo 6 e 8, Superior 9 e 16, Chalés 23 e 24 → `HOSPEDIN_FOUR_GUEST_PLACE_IDS=20181,20183,20184,20191,20201,20202`. Teto pretendido: Térreo 2, Superior 2, Chalé 2, Anexo 0. Em 2026-11-20 estava **zerado em todos os quartos** em produção. *(conferir)*
- [x] 2026-11-23: **limite de pets por reserva** resolvido no `origin/main` pelo commit `d62301e`: `MAX_PETS_PER_BOOKING = 2` em `src/lib/pet-policy.ts`, aplicado na busca (`src/lib/booking-search.ts`). O levantamento de 2026-11-21 ainda dizia "até 10", de um checkout desatualizado.
- [ ] **Mínimo de noites em feriados.** O campo existe nas promoções/datas especiais (`minNights` em `src/constants/specialDates.ts` e `src/lib/promotions/*`); conferir se os feriados de 2027 (Carnaval, Páscoa, Natal, Réveillon) estão cadastrados no admin, já que o site já vende março. *(conferir)*
- [ ] *(conferir)* Tarifas, inventário e acomodações do banco de produção batendo com a realidade (o mapa é a fonte oficial, ver `docs/architecture/MAPA_SOURCE_OF_TRUTH.md`).
- [ ] **Preço direto x Booking.** Definir a regra (o combinado nas outras pousadas é o site sempre mais barato que o preço Genius do Booking); hoje não há nada no código que garanta isso.
- [x] Regras de crianças e ocupação definidas e no ar: idade obrigatória na busca, cobrança por faixa, até 4 pagantes no estoque de 4, 1 criança de 0 a 5 anos além da capacidade com aviso só nesse caso (PRs #18 e #20, 2026-11-20).

### B10. Conteúdo

- [ ] *(conferir)* **Termos e condições, política de privacidade e política de cancelamento lidas e aprovadas pelo dono.** As páginas existem (`src/app/termos-e-condicoes`, `politica-de-privacidade`, `politica-de-cancelamento`), mas não há registro de aprovação.
- [ ] *(conferir)* Fotos profissionais em todos os quartos e nas áreas comuns, e textos conferidos pelo dono.
- [ ] *(conferir)* Telefone, WhatsApp, endereço e e-mail iguais em site, Google Meu Negócio, Instagram e Booking. O rodapé publica `contato@pousadadelplata.com.br` e o Instagram `@pousadadelplata`.
- [x] Nenhum resquício de outra pousada no conteúdo: busca por "Villa Verona", "Refúgio Serrano" e "Pousada Paraíso" em `src` e `public` não achou nada (só um comentário de código citando o Refúgio em `src/lib/booking-payment-window.ts`). "Serra Negra" aparece muito porque é a cidade da própria Delplata.

### B11. Domínio e SEO

- [ ] *(conferir)* `NEXT_PUBLIC_SITE_URL` e `NEXT_PUBLIC_BASE_URL` apontando para `https://www.pousadadelplata.com.br` em Production (o `.env.example` traz `localhost:3005` e o código cai em `localhost:3001`; sem a variável, as canônicas, o sitemap e os links dos e-mails saem errados).
- [ ] *(conferir)* `sitemap.xml` e `robots.txt` respondendo no domínio e as canônicas apontando para o `www`.
- [ ] *(conferir)* **Search Console** com o domínio verificado e o sitemap enviado.
- [ ] *(conferir)* Link do site no **Google Meu Negócio**, no Instagram e na ficha do Booking.
- [ ] *(conferir)* **Renovação automática do domínio** ligada e contato de administração atual.
- [ ] Não há nenhum `redirects` em `next.config.ts`. Se existir endereço antigo (site anterior, `.vercel.app`, domínio sem `www`), criar os redirects 301 para não perder o que já é indexado.

### B12. Branches, worktrees e limpeza

Estado em 2026-11-21 (último `git fetch` em 2026-11-20 15:06; sem nada modificado no `git status` e sem stashes).

- [x] 2026-11-23: `git fetch` e rebase da `main` local sobre `origin/main` (`02b3735`) — o checkout deixou de estar atrasado.
- [ ] **`origin/fix/migracao-occupied-units`** (`254820b`, 1 commit): adiciona a migração que faltava de `InventoryAdjustment.occupiedUnits`. A coluna já existe no Turso de produção e no `schema.prisma`, mas sem essa migração **um banco local novo quebra no seed (P2022)**. Vale mesclar: é só um `ALTER TABLE` e não tem efeito em produção.
- [ ] **`origin/chore/pendencias-pr21`** (`435f94a`, 4 commits): histórico do envio ao Hospedin no `PENDENCIAS.md` da raiz (B3).
- [ ] **`origin/feat/migracao-asaas`** (`e7fbf8c`, 4 commits): parada por decisão (B1).
- [ ] **`origin/docs/pendencia-upstash`** (`3214d58`, 1 commit): mexe no `SKILL.md` do karpathy, não no motor. Conferir se ainda interessa e apagar.
- [ ] **Branches `agent/*` abandonadas**, de julho de 2026, com 440 a 465 commits de diferença da `main`: `agent/booking-coupon-actions` (`934377a`, 2026-07-24, correção do Brick do Mercado Pago, que nem é mais usado), `agent/coupon-main-integration` (`67f09e2`, 2026-07-27) e `agent/crm-meta-foundation` (`97105a9`, 2026-07-23, CRM, cujo domínio foi removido na migração `20260901170000_remove_crm_domain`). Confirmar que nada delas é necessário e apagar as remotas.
- [ ] **Worktree antiga:** `.claude/worktrees/hospedin-reserva` está em `chore/pendencias-pr21` (`435f94a`), não na branch do nome, e tem um `.env` próprio. Remover com `git worktree remove` depois de resolver a branch.
- [ ] **Branches locais já mescladas** para apagar: `chore/remove-pix-discount-v2`, `ci/remove-crm-check`, `docs/pendencias-cron`, `fix/aviso-crianca-extra`, `fix/idade-e-4-hospedes`, `fix/validacao-email`, `sync/motor-villa-refugio`, `feat/hospedin-reserva`.
- [ ] Pastas locais de trabalho que não são versionadas e podem ir embora: `scratch/`, `.artifacts/`, `trash/`.

### B13. Alinhamento com as outras pousadas

O que as outras três já resolveram e vale avaliar aqui:

- [ ] **Do Refúgio Serrano:** pagamento só pelo Asaas, com webhook tratando parcelas do cartão (B1) e dependências atualizadas (B6). O prazo de 60 min + 60 min de folga, as rotas de e-mail fechadas e o aviso à equipe só na confirmada **já estão** aqui.
- [ ] **Da Pousada Paraíso:** mínimo de noites em feriados num lugar único (`src/constants/stay.ts` lá; aqui está espalhado entre `specialDates.ts` e as promoções) e **redirects de SEO** ao trocar de domínio (B11). Galerias com carrossel, expiração por cron e integração de ocupação com PMS externo **já estão** aqui.
- [ ] **Do Villa Verona:** o adaptador do Asaas isolado em branch é o mesmo caminho da B1; o backup sem destino persistente é a mesma pendência da B5 (dá para resolver uma vez e portar para as duas).
- [ ] **Pendências abertas do `todo.md` deste projeto**, ainda sem decisão: cupom de 5% por reserva abandonada (regra, validade, vínculo com e-mail/telefone, envio no e-mail de recuperação) e campo de busca por código/nome no painel de reservas.

## Fluxo de pagamento: melhorias em aberto (do antigo `todo.md`)

Origem: o antigo `todo.md` (texto completo, com critérios de aceite, em `docs/root-legacy/todo-fluxo-pagamentos.md`; 149 itens marcados como feitos e 102 em aberto no dia 2026-11-27). A maior parte das caixas vazias das seções 1 a 12 do arquivo original é do desenho inicial e **não foi conferida uma a uma contra o código**; antes de retomar qualquer uma, confira no código. O desconto de 5% no Pix foi removido em 2026-11-18 (decisão do dono), então os itens dele não se aplicam. O que está de fato sem decisão, como backlog futuro:

- [ ] **C1. Reativar algum desconto no motor** (seção 14.1 do original). Definir qual (Pix, cupom manual ou cupom automático de recuperação); o valor final sempre calculado e validado no backend, salvo no banco (valor original, código, desconto, valor pago) e igual nos e-mails.
- [ ] **C2. Cupom automático de 5% para reserva abandonada** (14.2). Definir quando conta como abandonada, a validade (24, 48 ou 72 h), se é único por reserva/hóspede e vinculado a e-mail/telefone; incluir no e-mail de recuperação com botão de volta ao motor; nunca para reserva já paga; sem envio duplicado; registrar no banco (cupom, reserva, hóspede, datas, status: gerado, enviado, usado, expirado, cancelado).
- [ ] **C3. Busca no painel de reservas** (14.3). Campo com lupa para buscar por código ou ID da reserva e por nome (e, se fizer sentido, e-mail e telefone), aceitando parte do texto, sem quebrar filtros, paginação nem ordenação, com estado vazio claro e testes por ID e nome.
- [ ] **C4. Alerta ao admin para pagamento não concluído** (seção 8). E-mail de lembrete para a pousada e um sino no painel com as reservas não concluídas, com opção de limpar. Envio por WhatsApp fica como melhoria futura, depois de estabilizada a integração.
- [ ] **C5. Padronizar os códigos de erro de pagamento** (seção 9): hoje a lista do original cita `PAYMENT_BRICK_ERROR`, `PAYMENT_REJECTED`, `PAYMENT_AMOUNT_MISMATCH`, `PAYMENT_DUPLICATE`, `PAYMENT_PAYER_MISSING`, `PAYMENT_API_ERROR` e `PAYMENT_UNEXPECTED_ERROR`. O Brick saiu no PR #6 (Checkout Pro), então rever a lista antes. Os testes do fluxo completo (seção 12 do original) estão em B8.

## Concluídas

- 2026-11-26: novo layout do site mesclado na `main` (PR #24) e correção do teste do `SearchWidget` que dependia da data de hoje e derrubava o build e o check "Interface" (PR #27). Evidência: 4 checks do GitHub verdes e 880 testes no PR; deploy da `main` a conferir (item 8).
- 2026-11-25: preço nas telas de acomodação mostra a diária da data mais próxima (hoje, se houver tarifa aberta), escrita como "Diária de hoje · dd/mm", em vez do menor valor do calendário. É a tarifa da tabela Rate, sem promoções; o total exato é o da tela de reserva. Conferir com dados reais em produção (item 8).
- 2026-11-25: foto do topo da home = piscina com a casa (`DJI_0845`), escolhida pelo usuário depois de testar `DJI_0866` (descartada: aparece uma pessoa e cadeiras empilhadas), `DJI_0864` e `DJI_0900`; "Mergulhe sem pressa" usa a `DJI_0911` (a `DSC_0241` é antiga, os muros mudaram, e só fica nas galerias); a seção final usa a `DJI_0864`; o jardim com balanço (`jardim-aptos/DJI_0896`) é o topo do /lazer e a capa do jardim na trilha da home. O preço "a partir de" do topo vem da primeira data com vaga e diz a data (hoje ou "em dd/mm").
- 2026-11-25: páginas internas no padrão novo (lazer, restaurante, contato com mensagens na própria página, blog, políticas, confirmação da reserva) e submenu "Acomodações" por ala com link para cada quarto. Evidência: capturas de tela em desktop e celular; o usuário aprovou no preview.

- 2026-11-25: política de cancelamento publicada em `/politica-de-cancelamento` com o texto enviado pelo usuário (EMBRATUR, Deliberação Normativa nº 165/95): saída antecipada sem devolução; mais de 14 dias = 100% de estorno ou crédito em 3 meses; mais de 7 dias = 50% ou crédito em 3 meses; menos de 7 dias, menos de 24 h ou no-show = sem estorno nem crédito; crédito em valor, não em diárias. Teste da página atualizado. Resumo das regras também no quadro "Cancelamento" do checkout (`src/app/reservar/page.tsx`). Os prazos ficam como estão no hotel (exatamente 14 ou 7 dias não têm regra própria; decisão do usuário). Falta conferir no site depois do deploy.
- 2026-11-22: limite de 2 pets por reserva (antes 10, herdado do Villa), valor central em `MAX_PETS_PER_BOOKING` (`src/lib/pet-policy.ts`), aplicado na busca, no seletor, na API (`invalid_pet_count`), na cotação e no preço; taxa R$ 20 por pet por diária. O Villa segue com 10 pets e R$ 40. Falta conferir em produção após o deploy.
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
