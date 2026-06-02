# Escopo do Projeto: CRM e n8n

## Objetivo
Centralizar atendimento (WhatsApp/site), pipeline comercial e automações sem quebrar o motor de reservas.

## Entradas
- webhook da Evolution API;
- ações humanas no painel CRM;
- eventos internos do CRM.

## Saídas
- mensagens de resposta;
- mudanças de estágio no pipeline;
- logs de auditoria;
- chamadas para workflows do n8n.

## Módulos principais
- `src/app/admin/inbox/*`
- `src/app/admin/crm/*`
- `src/app/api/whatsapp/*`
- `src/app/api/crm/*`
- `src/lib/whatsapp/*`
- `src/lib/crm/*`
- `n8n/workflows/*`

## Banco
- `Contact`, `Conversation`, `Message`, `PipelineCard`, `InternalActionLog` e tabelas auxiliares de automação.

## Regra operacional
- n8n não acessa banco diretamente; usa API interna autenticada.
