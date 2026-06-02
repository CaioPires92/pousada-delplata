# SDD — CRM WhatsApp Delplata

## 0. Metadados do documento

- Status: Draft tecnico em uso
- Ultima revisao: 2026-05-14
- Escopo: Projeto B (CRM + n8n)
- Dependencias externas: Evolution API, n8n
- Dependencia interna critica: Motor de Reservas (Projeto A) para disponibilidade/tarifa

## 1. Contexto

Este repositorio contem dois dominios:

1. Motor de Reservas (fonte de verdade para disponibilidade/tarifa/reserva/pagamento).
2. CRM WhatsApp (fonte de verdade para atendimento e pipeline comercial).

Objetivo: evoluir o CRM sem quebrar o motor existente.

## 2. Escopo

### Incluido
- recebimento de mensagens via Evolution API;
- contato/conversa/mensagem;
- inbox e resposta manual;
- pipeline comercial e estagios;
- eventos internos para automacao via n8n;
- logs de auditoria.

### Fora de escopo (fase atual)
- escrita direta de n8n no banco;
- substituicao do motor de reservas;
- confirmacao automatica de reserva sem API validada.

## 3. Arquitetura logica

```txt
WhatsApp/Evolution -> /api/whatsapp/webhook -> servicos CRM -> Prisma/Turso
                                                   |                    |
                                                   +-> eventos -> n8n --+
                                                              |
                                                  chamadas autenticadas para API CRM
```

## 4. Componentes

### APIs
- `POST /api/whatsapp/webhook/[[...slug]]`
- `POST /api/whatsapp/send`
- `GET /api/crm/conversations`
- `GET /api/crm/conversations/[id]`
- `PATCH /api/crm/pipeline/cards/[id]`
- endpoints internos de automacao em `/api/crm/*`

### Servicos
- `src/lib/whatsapp/evolution.ts`
- `src/lib/crm/identity.ts`
- `src/lib/crm/conversationFlow.ts`
- `src/lib/crm/pipelineMachine.ts`
- `src/lib/crm/events.ts`
- `src/lib/crm/automationQueue.ts`

### UI
- inbox e detalhe: `src/app/admin/inbox/*`
- modulo CRM: `src/app/admin/crm/*`

## 5. Modelo de dados (alto nivel)

- `Contact`
- `Conversation`
- `Message`
- `PipelineCard`
- `InternalActionLog`
- tabelas auxiliares de automacao e historico de estagio

## 6. Contrato de integracao com n8n

Regra principal:

```txt
n8n nunca acessa banco diretamente.
n8n sempre chama API interna autenticada do CRM.
```

Evento minimo emitido pelo CRM:

```json
{
  "timestamp": "2026-05-14T00:00:00.000Z",
  "action": "QuoteRequested",
  "conversationId": "...",
  "contactId": "...",
  "metadata": {}
}
```

## 7. NFRs

- TypeScript estrito;
- idempotencia para mensagens por `externalId` quando disponivel;
- operacoes criticas com transacao;
- logs acionaveis para diagnostico;
- compatibilidade retroativa com rotas do motor.

## 8. Riscos e mitigacoes

- Duplicidade de mensagem: dedupe por identificadores externos e janela temporal.
- Corrida de automacao/humano: usar `chatbotEnabled` + `automationPausedUntil`.
- Falha de n8n: nao bloquear persistencia da conversa; registrar falha.

## 9. Criterios de aceite

- mensagem inbound aparece na inbox;
- resposta manual enviada e persistida;
- pipeline atualiza com rastreabilidade;
- evento chega ao n8n sem quebrar atendimento;
- falha externa nao derruba fluxo principal.

## 10. Rastreabilidade (requisito -> evidencia)

- Inbound WhatsApp persistido -> `src/app/api/whatsapp/webhook/[[...slug]]/route.ts`
- Resposta manual persistida -> `src/app/api/whatsapp/send/route.ts`
- Pipeline e eventos -> `src/lib/crm/pipelineMachine.ts`, `src/lib/crm/events.ts`
- Fila/automacao resiliente -> `src/lib/crm/automationQueue.ts`, `src/lib/crm/automationQueueWorker.ts`
- Cobertura de regressao -> `src/app/api/whatsapp/webhook/route.test.ts`, `src/app/api/whatsapp/send/route.test.ts`

## 11. Referencias

- `sdd-crm-delplata/` (requirements, design, task list, contracts)
- `n8n/README.md`
- `docs/ops/CRM_N8N_PERSISTENT_RUNBOOK.md`
