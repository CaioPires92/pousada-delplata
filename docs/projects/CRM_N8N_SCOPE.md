# Escopo do Projeto: CRM e automação futura

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
- chamadas externas de automação quando a nova integração existir.

## Módulos principais
- `src/app/admin/inbox/*`
- `src/app/admin/crm/*`
- `src/app/api/whatsapp/*`
- `src/app/api/crm/*`
- `src/lib/whatsapp/*`
- `src/lib/crm/*`

## Banco
- `Contact`, `Conversation`, `Message`, `PipelineCard`, `InternalActionLog` e tabelas auxiliares de automação.

## Regra operacional
- integrações externas não acessam banco diretamente; usam API interna autenticada.
