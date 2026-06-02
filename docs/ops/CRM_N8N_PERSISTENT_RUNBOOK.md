# n8n Persistente Runbook

Objetivo: n8n com estado persistente e operação previsível.

## Requisitos

- banco persistente (Postgres recomendado)
- credenciais seguras (sem secrets hardcoded)
- backup periódico
- URL fixa com HTTPS
- política de atualização e rollback

## Checklist

- [ ] workflows ativos sobrevivem reboot
- [ ] credenciais validadas após restart
- [ ] webhook de entrada ativo em URL fixa
- [ ] backup e restauração testados
- [ ] integração CRM (`/api/crm/internal-actions`) validada
