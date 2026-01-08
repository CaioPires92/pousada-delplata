# Checklist de Produção (V1.0)

Este documento lista as tarefas críticas que **DEVEM** ser realizadas para garantir que o sistema opere corretamente em produção.

## 🔴 Crítico (Bloqueante)

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
- [ ] Definir `NEXT_PUBLIC_BASE_URL` na Vercel com o domínio final (Ex: `https://sua-pousada.vercel.app`).
- [ ] Configurar a URL de notificação no Painel do Mercado Pago (se necessário, ou confiar na criação automática da preferência que já faz isso).

## 🟡 Monitoramento & Segurança (Recomendado)

### 3. Logs e Observabilidade (Sentry)
Erros em produção (como falha no envio de email ou erro no webhook) não aparecem no navegador do usuário.
- [ ] Criar conta no [Sentry.io](https://sentry.io).
- [ ] Criar projeto Next.js no Sentry.
- [ ] Adicionar `SENTRY_DSN` nas variáveis da Vercel.
- [ ] Configurar SDK do Sentry no projeto (`npx wizard@latest sentry` no futuro) para capturar exceções não tratadas.

### 4. Segurança Admin
- [ ] Garantir que `JWT_SECRET` na Vercel seja uma string longa e aleatória (use `openssl rand -hex 32` para gerar).
- [ ] Verificar se o cookie `admin_token` está sendo setado como `Secure` (automático em produção via `process.env.NODE_ENV`).
