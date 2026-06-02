# CRM VPS Definitiva Runbook

Objetivo: operação persistente da Evolution API em VPS estável.

## Requisitos

- Docker/Compose com restart policy
- volumes persistentes para dados/sessões
- HTTPS/TLS válido
- backup diário automatizado
- healthcheck e logs centralizados

## Checklist

- [ ] Evolution sobe automaticamente após reboot
- [ ] volume persistente montado
- [ ] endpoint HTTPS estável e monitorado
- [ ] backup/restauração testados
- [ ] webhook de teste chega no CRM
