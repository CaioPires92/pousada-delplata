# Event Contracts — CRM WhatsApp Delplata

## 1. Objetivo

Padronizar os eventos internos do CRM para permitir automação futura com n8n sem duplicar regra de negócio e sem acesso direto ao banco.

## 2. Envelope padrão

Todo evento deve seguir este formato:

```json
{
  "eventType": "MessageReceived",
  "eventId": "evt_...",
  "occurredAt": "2026-05-09T21:00:00.000Z",
  "source": "crm",
  "channel": "whatsapp",
  "conversationId": "...",
  "contactId": "...",
  "payload": {}
}
```

## 3. Eventos principais

### MessageReceived

Emitido quando uma mensagem inbound válida é salva.

```json
{
  "eventType": "MessageReceived",
  "channel": "whatsapp",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "messageId": "msg_123",
    "text": "Boa tarde, qual o valor para 2 adultos?",
    "messageType": "text",
    "externalId": "evo_123"
  }
}
```

### LeadCreated

Emitido quando um card novo é criado.

```json
{
  "eventType": "LeadCreated",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "pipelineCardId": "card_123",
    "stage": "NOVO_LEAD",
    "source": "whatsapp"
  }
}
```

### PipelineStageChanged

Emitido quando um card muda de estágio.

```json
{
  "eventType": "PipelineStageChanged",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "pipelineCardId": "card_123",
    "fromStage": "QUALIFICANDO",
    "toStage": "ORCAMENTO_ENVIADO",
    "reason": "Orçamento enviado pelo WhatsApp",
    "actorType": "human"
  }
}
```

### HumanTookOver

Emitido quando atendente responde manualmente ou clica em assumir conversa.

```json
{
  "eventType": "HumanTookOver",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "pausedUntil": "2026-05-09T21:30:00.000Z",
    "reason": "Resposta manual enviada pelo CRM"
  }
}
```

### AutomationPaused

Emitido quando automação é pausada.

```json
{
  "eventType": "AutomationPaused",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "pausedUntil": "2026-05-09T21:30:00.000Z",
    "reason": "Humano assumiu"
  }
}
```

### QuoteRequested

Emitido quando cliente informa dados suficientes para orçamento.

```json
{
  "eventType": "QuoteRequested",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "checkin": "2026-06-15",
    "checkout": "2026-06-17",
    "adults": 2,
    "children": 1
  }
}
```

### QuoteSent

Emitido quando orçamento é enviado.

```json
{
  "eventType": "QuoteSent",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "estimatedValue": 850,
    "currency": "BRL",
    "optionsCount": 2,
    "sentBy": "n8n"
  }
}
```

### ReservationStarted

Emitido quando cliente inicia intenção clara de reservar.

```json
{
  "eventType": "ReservationStarted",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "quoteId": "quote_123",
    "pipelineCardId": "card_123"
  }
}
```

### PaymentPending

Emitido quando reserva depende de pagamento.

```json
{
  "eventType": "PaymentPending",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "reservationDraftId": "draft_123",
    "amount": 850,
    "currency": "BRL"
  }
}
```

### ReservationConfirmed

Emitido quando reserva é confirmada.

```json
{
  "eventType": "ReservationConfirmed",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "bookingId": "booking_123",
    "pipelineCardId": "card_123"
  }
}
```

### LeadLost

Emitido quando oportunidade é perdida.

```json
{
  "eventType": "LeadLost",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "pipelineCardId": "card_123",
    "lostReason": "Preço alto",
    "actorType": "human"
  }
}
```

## 4. Contrato para ações vindas do n8n

Endpoint:

```txt
POST /api/crm/internal-actions
Authorization: Bearer CRM_INTERNAL_API_TOKEN
```

Envelope padrão de requisição:

```json
{
  "action": "PAUSE_AUTOMATION",
  "payload": {}
}
```

### MOVE_PIPELINE_CARD

```json
{
  "action": "MOVE_PIPELINE_CARD",
  "payload": {
    "pipelineCardId": "card_123",
    "toStage": "ORCAMENTO_ENVIADO",
    "reason": "n8n enviou orçamento automaticamente"
  }
}
```

### SEND_WHATSAPP_MESSAGE

```json
{
  "action": "SEND_WHATSAPP_MESSAGE",
  "payload": {
    "conversationId": "conv_123",
    "text": "Encontrei uma opção para sua data. Posso te enviar?"
  }
}
```

### PAUSE_AUTOMATION

```json
{
  "action": "PAUSE_AUTOMATION",
  "payload": {
    "conversationId": "conv_123",
    "minutes": 30,
    "reason": "Humano assumiu atendimento"
  }
}
```

### UPDATE_LEAD_FIELDS

```json
{
  "action": "UPDATE_LEAD_FIELDS",
  "payload": {
    "pipelineCardId": "card_123",
    "estimatedValue": 850,
    "intendedCheckin": "2026-06-15",
    "intendedCheckout": "2026-06-17",
    "adults": 2,
    "children": 1,
    "roomTypeInterest": "Chale"
  }
}
```

## 5. Regras de segurança

- Toda ação do n8n exige token interno.
- Toda ação deve gerar log.
- Se conversa estiver pausada, n8n não deve enviar mensagem.
- Se o card não existir, retornar erro claro.
- Se stage for inválido, retornar erro claro.

## 6. Respostas padrão

Sucesso:

```json
{
  "ok": true,
  "action": "MOVE_PIPELINE_CARD",
  "result": {}
}
```

Erro:

```json
{
  "ok": false,
  "error": "INVALID_PAYLOAD",
  "message": "Payload inválido"
}
```

Erros esperados:

```txt
401 UNAUTHORIZED
400 INVALID_PAYLOAD
400 INVALID_ACTION
404 NOT_FOUND
409 AUTOMATION_PAUSED
500 INTERNAL_ERROR
```
