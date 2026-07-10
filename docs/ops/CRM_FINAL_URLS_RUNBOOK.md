# CRM Final URLs Runbook

Objetivo: remover dependência de túneis temporários e operar com URLs persistentes.

## URLs finais esperadas

- App (Vercel): `https://www.pousadadelplata.com.br`
- Webhook CRM: `https://www.pousadadelplata.com.br/api/whatsapp/webhook/...`
- Internal actions: `https://www.pousadadelplata.com.br/api/crm/internal-actions`
- Evolution endpoint estável (sem URL descartável)

## Passos de corte

1. Configurar DNS/SSL das URLs finais.
2. Atualizar env vars de integração (`EVOLUTION_API_URL`).
3. Desativar túneis temporários (ngrok/cloudflared) e revogar tokens associados.
4. Testar fluxo ponta a ponta:
   - inbound webhook
   - resposta manual
   - internal actions

## Checklist de validação

- [ ] Sem referências a `ngrok` em env de produção.
- [ ] Sem referências a `trycloudflare` em env de produção.
- [ ] Eventos recentes fluindo em `/admin/crm/events`.
- [ ] Alertas operacionais sem falha crítica contínua.
