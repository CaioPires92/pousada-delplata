# Delplata-Motor

Repositorio monolitico com dois projetos:

1. Site + Motor de Reservas
2. CRM + WhatsApp

## Onde comeca cada projeto

- Site + Motor: `src/app` (rotas publicas e reserva), `src/app/api/availability`, `src/app/api/bookings`, `src/app/api/payments`, `src/lib/mercadopago`.
- CRM + WhatsApp: `src/app/admin/inbox`, `src/app/admin/crm`, `src/app/api/crm`, `src/app/api/whatsapp`, `src/lib/crm`, `src/lib/whatsapp`.

Detalhamento completo em:
- `docs/architecture/PROJECT_BOUNDARIES.md`
- `docs/architecture/REPO_OWNERSHIP_MAP.md`
- `docs/projects/RESERVAS_SCOPE.md`
- `docs/projects/CRM_N8N_SCOPE.md`

## Scripts uteis

```bash
npm run dev
npm run crm:reset
npm run crm:reinstall
npm run crm:docker:up
npm run crm:evolution:create
npm run crm:evolution:qr
npm run crm:evolution:webhook
npm run lint
npm run typecheck
npm run test
```

## CRM local no WSL

O caminho operacional suportado para Evolution local e sempre o compose em `evolution-docker/`.

Se o app estiver rodando no WSL e a Evolution estiver no Docker Desktop do Windows, `npm run crm:docker:up` agora:

- sobe a stack pelo Docker disponivel (WSL ou Windows);
- detecta quando `localhost:8080` do WSL nao enxerga a Evolution do Windows;
- inicia um bridge local em `127.0.0.1:8080` para manter `EVOLUTION_API_URL=http://localhost:8080` funcionando no app.

## Observacao

Existe trabalho em andamento no repositorio (arquivos modificados). A organizacao documental acima foi feita para clarificar fronteiras sem alterar comportamento de runtime.
# delplata-dashboard
