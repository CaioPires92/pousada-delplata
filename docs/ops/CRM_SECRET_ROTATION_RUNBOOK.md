# CRM Secret Rotation Runbook

Objetivo: rotacionar segredos operacionais sem interromper atendimento.

## Segredos alvo

- `EVOLUTION_API_KEY`
- `CRM_INTERNAL_API_TOKEN`
- `N8N` credenciais/API key
- tokens MCP/n8n auxiliares
- túneis temporários expostos (revogar)

## Passos

1. Gerar novos segredos fortes (>= 32 chars).
2. Atualizar variáveis no ambiente de produção (Vercel) e no n8n.
3. Atualizar `.env` local somente para testes controlados.
4. Reiniciar serviços que dependem dos segredos.
5. Revogar segredos antigos e túneis temporários.

## Validação pós-rotação

1. `POST /api/crm/internal-actions` com token novo.
2. Envio manual em `/api/whatsapp/send`.
3. Disparo de webhook de teste para `/api/whatsapp/webhook/...`.
4. Verificar eventos no `/admin/crm/events`.

## Auditoria mínima

Registrar no changelog operacional:

- data/hora da rotação
- quais segredos foram trocados
- ambiente impactado
- responsável
- resultado da validação
