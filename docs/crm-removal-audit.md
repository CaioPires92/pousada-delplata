# Auditoria de remoção do CRM

Branch de segurança: `codex/remove-crm-cleanup`

## Componentes exclusivos do CRM identificados

- Telas: `src/app/admin/crm`, `src/app/admin/inbox`, `src/app/admin/pipeline`, `src/app/admin/settings/chatbot`.
- APIs: `src/app/api/crm`, `src/app/api/admin/crm`, `src/app/api/admin/chatbot`, jobs `src/app/api/cron/crm-*`.
- Integrações: webhook Evolution/WhatsApp, bridge na porta 3002, fila de automação e workflows n8n.
- Modelos CRM: `Contact`, `Conversation`, `SupervisedReplySuggestion`, `AutomationQueueJob`, `DeadLetterQueueItem`, `Message`, `MessagingWebhookEvent`, `PipelineCard`, `ReservationDraft`, `PipelineStageHistory`, `ChatbotSettings`, `FollowUpSettings`, `PostStaySettings`, `ChatbotRule`, `InternalActionLog`, `CrmEventReceipt`, `InternalNote`.

## Dependências que precisam ser desacopladas antes de remover os modelos

- `Booking.crmContactId` e `Booking.crmConversationId` (relações opcionais).
- `CouponGrant.contactId` (integração de cupons com contatos).
- Jornadas de WhatsApp acionadas por reservas/pagamentos.
- APIs e testes que importam `src/lib/crm`.

## Backup

O banco SQLite atual foi preservado em `prisma/dev.db.crm-backup-20260901` antes da limpeza.
