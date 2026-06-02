# Checklist de Produção (V1.0)

Este documento lista as tarefas críticas que **DEVEM** ser realizadas para garantir que o sistema opere corretamente em produção.

## 🔴 Crítico (Bloqueante)

### 0. Variáveis de Ambiente (Obrigatórias)
- [ ] `DATABASE_URL`
- [ ] `DATABASE_AUTH_TOKEN`
- [ ] `JWT_SECRET`
- [ ] `NEXT_PUBLIC_BASE_URL` (domínio final, ex.: `https://sua-pousada.vercel.app`)
- [ ] `NEXT_PUBLIC_APP_URL` (normalmente igual ao domínio final)
- [ ] `MP_ACCESS_TOKEN`
- [ ] `MP_WEBHOOK_SECRET` (recomendado para validar assinatura do webhook)
- [ ] `SMTP_HOST`
- [ ] `SMTP_PORT`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASS`

### 0. Banco de Dados (Limpeza Inicial)
Antes de lançar, é recomendado limpar os dados de teste.
- [ ] Rodar `npx prisma db push --force-reset` (CUIDADO: APAGA TUDO).
- [ ] Rodar `node scripts/seed-production.js` para criar Admin e Quartos oficiais.

### 1. Configuração de Email (SMTP)
O envio de vouchers automáticos depende dessas variáveis. Sem isso, o cliente paga mas não recebe confirmação.
- [ ] Acessar painel da Vercel > Settings > Environment Variables.
- [ ] Adicionar `SMTP_HOST` (Ex: `smtp.gmail.com`).
- [ ] Adicionar `SMTP_PORT` (Ex: `587`).
- [ ] Adicionar `SMTP_USER` (Email que enviará os vouchers).
- [ ] Adicionar `SMTP_PASS` (Senha de App - *App Password* - gerada no Gmail/Provedor, não é a senha de login).

### 2. Configuração de Webhook
Para que o Mercado Pago avise o sistema sobre pagamentos aprovados.
- [ ] Confirmar endpoint oficial: `POST /api/webhooks/mercadopago` (é o `notification_url` usado no checkout).
- [ ] Garantir que o painel do Mercado Pago aponte para o endpoint oficial (se estiver configurado manualmente).
- [ ] Confirmar que o endpoint legado `POST /api/mercadopago/webhook` está desativado em produção (retorna 410), a menos que `ALLOW_LEGACY_MP_WEBHOOK=true`.

## 🟡 Deploy & Ambiente

### 1. Ambiente (Vercel)
- [ ] Root Directory: raiz do repositorio
- [ ] Variáveis de ambiente:
  - `DATABASE_URL` (Turso) e `DATABASE_AUTH_TOKEN` (Turso)
  - `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
  - `ADMIN_JWT_SECRET` (gerar com `openssl rand -hex 32`)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
  - `NEXT_PUBLIC_APP_URL` (após primeiro deploy: URL da Vercel)
- [ ] Build: `prisma generate` e `next build --webpack`

### 2. Webhooks (Mercado Pago)
- [ ] Endpoint oficial: `POST /api/webhooks/mercadopago`
- [ ] Eventos: marcar apenas Payments
- [ ] Endpoint legado desativado em produção (retorna 410) — variável `ALLOW_LEGACY_MP_WEBHOOK` deve estar ausente
- [ ] Teste: simular notificação e verificar atualização de Payment/Booking

### 3. Logs e Observabilidade (Sentry)
- [ ] Criar projeto Next.js no Sentry
- [ ] Adicionar `SENTRY_DSN` (server/edge) e `NEXT_PUBLIC_SENTRY_DSN` (browser)
- [ ] Monitorar erros pós-deploy (webhooks, emails, API)

### 4. Segurança Admin
- [ ] `ADMIN_JWT_SECRET` forte e rotacionado periodicamente
- [ ] Cookie `admin_token` com `Secure` em produção
- [ ] Rate limit global (Upstash) para login e endpoints sensíveis

### 5. Controle de Logs
- [ ] `PRISMA_LOG_QUERIES=0` em produção
- [ ] Auditar tentativas de login e falhas de webhook
