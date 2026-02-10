# Pousada Delplata — Motor de Reservas

## Visão Geral
- Frontend responsivo (Next.js + React)
- Backend com APIs (Disponibilidade, Reservas, Pagamentos)
- Integração Mercado Pago
- Painel administrativo
- Testes automatizados

## Tecnologias
- Next.js 16, React 19, TypeScript
- Prisma ORM, Turso (LibSQL)
- Nodemailer, JWT, bcryptjs

## Scripts úteis
```bash
# Desenvolvimento
npm run dev        # inicia servidor local

# Verificação
npm run lint       # ESLint
npm run typecheck  # TypeScript --noEmit

# Banco (guardrails com dry-run/confirm)
npm run db:update:desc:dry
npm run db:update:desc
npm run db:update:prices:dry
npm run db:update:prices
npm run db:update:fees:dry
npm run db:update:fees
```

## Estrutura
```
src/app/...
prisma/schema.prisma
scripts/manage-pousada.ts
```

## Deploy & Ambiente
- Configure variáveis na Vercel:
  - DATABASE_URL (Turso), DATABASE_AUTH_TOKEN
  - NEXT_PUBLIC_MP_PUBLIC_KEY, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET
  - ADMIN_JWT_SECRET
  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  - NEXT_PUBLIC_APP_URL (após primeiro deploy)
- Root Directory na Vercel: raiz do repositorio
- Webhook: `POST /api/webhooks/mercadopago` (evento Payments)

## Roadmap
Consulte [ROADMAP.md](./ROADMAP.md) para próximos passos, segurança e melhorias.
## Diagnóstico rápido
```bash
npm run diag:mp:credentials
npm run diag:payments
npm run diag:booking:last
npm run diag:legacy:all
```

Scripts legados/manuais foram movidos para:
- `scripts/diagnostics/`
- `scripts/manual/`