# CI/CD

## CI (Pull Request / Push)
- Workflow: `.github/workflows/ci.yml`
- Roda no diretório `web/`: `npm ci`, `npm run lint`, `npm run test:coverage`, `npm run build`

## CD (Deploy na Vercel)
- Workflow: `.github/workflows/deploy.yml`
- Dispara em push para `main/master` e `workflow_dispatch`
- Requer secrets no GitHub:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID` (ou `ORG_ID`)
  - `VERCEL_PROJECT_ID` (ou `PROJECT_ID`)
  - opcional: `VERCEL_TEAM_ID` (ou `TEAM_ID`)

## Observações
- `web/.env` não deve ser commitado (use `.env.example` como template).
