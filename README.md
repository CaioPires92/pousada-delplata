# Delplata Motor

Site institucional e motor de reservas da Pousada Delplata.

## Principais áreas

- site público e páginas institucionais: `src/app`;
- disponibilidade, tarifas e inventário: `src/app/api/availability`, `src/app/admin/mapa` e `src/lib/availability`;
- reservas e pagamentos: `src/app/reservar`, `src/app/api/bookings` e `src/app/api/mercadopago`;
- painel administrativo de reservas: `src/app/admin/reservas`;
- banco e migrations: `prisma`.

## Desenvolvimento

```bash
npm ci
npm run dev:web
```

## Verificação

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Mais detalhes estão em `docs/README.md`.
# delplata-dashboard
