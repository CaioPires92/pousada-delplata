# Environment Variables Configuration Guide

## Development (Local SQLite)

For local development, configure your `.env` file with:

```bash
DATABASE_URL="file:./prisma/dev.db"
# Do NOT set DATABASE_AUTH_TOKEN for local development
```

This will use the local SQLite database at `prisma/dev.db`.

## Production (Turso / LibSQL)

For production deployment on Vercel with Turso, configure:

```bash
DATABASE_URL="libsql://your-database.turso.io"
DATABASE_AUTH_TOKEN="your-turso-auth-token"
```

The presence of `DATABASE_AUTH_TOKEN` switches to Turso/LibSQL adapter.

## Other Required Variables

### Application (URLs)
```bash
NEXT_PUBLIC_BASE_URL="http://localhost:3001"  # em produção: https://seu-dominio
NEXT_PUBLIC_APP_URL="http://localhost:3001"   # usado para links e callbacks
```

### Admin Auth
```bash
JWT_SECRET="uma-string-longa-e-aleatoria"
ADMIN_EMAIL="admin@delplata.com.br"
ADMIN_PASSWORD="uma-senha-forte"
```

### Mercado Pago
```bash
NEXT_PUBLIC_MP_PUBLIC_KEY="your-mercadopago-public-key"
MP_ACCESS_TOKEN="your-mercadopago-access-token"
MP_WEBHOOK_SECRET="your-mercadopago-webhook-secret" # recomendado para validar assinatura
```

### Email (Nodemailer)
```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-email-app-password"
```

### Observabilidade (opcional)
```bash
SENTRY_DSN="https://<hash>@o0.ingest.sentry.io/<project>"
NEXT_PUBLIC_SENTRY_DSN="https://<hash>@o0.ingest.sentry.io/<project>" # para capturar erros no browser
```

### Reserva (opcional)
```bash
PENDING_BOOKING_TTL_MINUTES=30  # tempo para expirar reservas pendentes que bloqueiam inventário
```

## Database Setup

### First Time Setup

1. Ensure DATABASE_URL points to local SQLite:
   ```bash
   DATABASE_URL="file:./prisma/dev.db"
   ```

2. Push schema to database:
   ```bash
   npm run build  # This runs prisma generate
   # or directly:
   npx prisma db push
   ```

3. Seed database with sample data:
   ```bash
   npm install bcryptjs  # if not already installed
   node prisma/seed.js
   ```

### After Schema Changes

If you modify `prisma/schema.prisma`:

```bash
npx prisma db push  # Sync database with schema
npx prisma generate  # Regenerate Prisma Client
```

## Troubleshooting

**Error: "no such table: main.RoomType"**
- Solution: DATABASE_URL must be set to `file:./prisma/dev.db` for local development
- Run `npx prisma db push` to create tables
- Run `node prisma/seed.js` to populate data

**Error: "Cannot find module 'bcryptjs'"**
- Solution: `npm install bcryptjs`

**Build succeeds but runtime fails**
- Check that you're using `--webpack` flag in scripts
- Verify `serverExternalPackages` includes libsql packages in next.config.ts
