# Delplata-Motor

Repositorio monolitico com dois projetos:

1. Site + Motor de Reservas
2. CRM + Fluxos n8n

## Onde comeca cada projeto

- Site + Motor: `src/app` (rotas publicas e reserva), `src/app/api/availability`, `src/app/api/bookings`, `src/app/api/payments`, `src/lib/mercadopago`.
- CRM + n8n: `src/app/admin/inbox`, `src/app/admin/crm`, `src/app/api/crm`, `src/app/api/whatsapp`, `src/lib/crm`, `src/lib/whatsapp`, `n8n/workflows`.

Detalhamento completo em:
- `docs/architecture/PROJECT_BOUNDARIES.md`
- `docs/architecture/REPO_OWNERSHIP_MAP.md`
- `docs/projects/RESERVAS_SCOPE.md`
- `docs/projects/CRM_N8N_SCOPE.md`

## Scripts uteis

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
```

## Observacao

Existe trabalho em andamento no repositorio (arquivos modificados). A organizacao documental acima foi feita para clarificar fronteiras sem alterar comportamento de runtime.
# delplata-dashboard
