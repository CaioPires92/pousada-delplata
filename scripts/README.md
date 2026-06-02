# Scripts Organization

Este diretorio foi dividido por dominio para reduzir ambiguidade:

- `scripts/reservas/*`: scripts do Site + Motor de Reservas
- `scripts/crm/*`: scripts do CRM + n8n
- `scripts/shared/*`: scripts compartilhados

## Compatibilidade

Alguns caminhos antigos em `scripts/*` e `scripts/diagnostics/*` foram mantidos como wrappers para nao quebrar comandos legados.

Padrao desejado para novos scripts:
- reservas -> adicionar em `scripts/reservas/...`
- crm/n8n -> adicionar em `scripts/crm/...`
- cross-domain -> adicionar em `scripts/shared/...`
