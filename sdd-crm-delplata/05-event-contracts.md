# Event Contracts — CRM WhatsApp Delplata

## 1. Objetivo

Padronizar os eventos internos do CRM para permitir automação futura com n8n sem duplicar regra de negócio e sem acesso direto ao banco.

## 2. Envelope padrão

Todo evento deve seguir este formato:

```json
{
  "eventId": "evt_...",
  "eventType": "MessageReceived",
  "conversationId": "...",
  "contactId": "...",
  "pipelineCardId": "...",
  "phone": "5511999999999",
  "customerName": "João Silva",
  "messageText": "...",
  "source": "crm",
  "timestamp": "2026-05-09T21:00:00.000Z",
  "metadata": {}
}
```

### Envelope atual enviado ao n8n

Na implementação atual, `emitCrmEvent` envia o evento para `N8N_WEBHOOK_URL` em formato simples, compatível com o workflow local validado em 2026-05-12:

```json
{
  "timestamp": "2026-05-12T20:08:43.751Z",
  "action": "QuoteRequested",
  "contactId": "646d3472-c46a-477d-a33d-f537147d1571",
  "conversationId": "5ccbc27c-7b49-4370-a174-d408b44a03a7",
  "metadata": {}
}
```

Equivalencia provisoria:

```txt
action -> eventType
timestamp -> occurredAt
metadata -> payload
```

O contrato canonico acima continua sendo o alvo desejado. Enquanto o app estiver emitindo `action` e `metadata`, o n8n deve consumir esse formato real.

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
  "metadata": {
    "checkin": "2026-06-15",
    "checkout": "2026-06-17",
    "adults": 2,
    "children": 1
  }
}
```

### FAQ_REQUESTED

Emitido quando o bot detecta uma dúvida frequente que pode ser respondida pelo n8n.

```json
{
  "eventType": "FAQ_REQUESTED",
  "conversationId": "conv_123",
  "messageText": "Aceita pet?",
  "metadata": {
    "category": "pet",
    "confidence": 0.95
  }
}
```

### RESERVATION_INTENT_DETECTED

Emitido quando o bot detecta uma intenção clara de fechar a reserva.

```json
{
  "eventType": "RESERVATION_INTENT_DETECTED",
  "conversationId": "conv_123",
  "messageText": "Vou querer reservar sim, como faço o pix?",
  "metadata": {
    "detectedIntent": "confirm_booking",
    "confidence": 0.98
  }
}
```

### CUSTOMER_REPLIED_AFTER_QUOTE

Emitido quando o cliente responde após ter recebido um orçamento, mas sem ser um fechamento direto.

```json
{
  "eventType": "CUSTOMER_REPLIED_AFTER_QUOTE",
  "conversationId": "conv_123",
  "messageText": "Tem alguma opção com vista para o jardim?",
  "metadata": {
    "lastQuoteId": "quote_123"
  }
}
```

### CUSTOMER_NO_RESPONSE

Emitido via cron/job quando o cliente fica muito tempo sem responder após uma cotação (follow-up).

```json
{
  "eventType": "CUSTOMER_NO_RESPONSE",
  "conversationId": "conv_123",
  "metadata": {
    "hoursSinceLastInteraction": 24,
    "currentStage": "ORCAMENTO_ENVIADO"
  }
}
```

Exemplo real emitido por `POST /api/crm/quote`:

```json
{
  "timestamp": "2026-05-12T20:08:43.751Z",
  "action": "QuoteRequested",
  "contactId": "646d3472-c46a-477d-a33d-f537147d1571",
  "conversationId": "5ccbc27c-7b49-4370-a174-d408b44a03a7",
  "metadata": {
    "checkin": "2026-06-15",
    "checkout": "2026-06-17",
    "adults": 2,
    "children": 0,
    "childrenAges": [],
    "resultOk": true,
    "optionsCount": 4,
    "error": null
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

Payload recomendado para implementação real:

```json
{
  "eventType": "QuoteSent",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "quoteRequest": {
      "checkin": "2026-06-15",
      "checkout": "2026-06-17",
      "adults": 2,
      "children": 0
    },
    "selectedOption": null,
    "options": [
      {
        "roomTypeId": "room_1",
        "roomTypeName": "Apartamento Anexo",
        "remainingUnits": 2,
        "totalPrice": 538,
        "currency": "BRL"
      }
    ],
    "messageId": "msg_123",
    "externalMessageId": "evo_123",
    "sentBy": "n8n"
  }
}
```

Envelope atual equivalente:

```json
{
  "timestamp": "2026-05-12T21:10:00.000Z",
  "action": "QuoteSent",
  "contactId": "contact_123",
  "conversationId": "conv_123",
  "metadata": {
    "checkin": "2026-06-15",
    "checkout": "2026-06-17",
    "adults": 2,
    "children": 0,
    "optionsCount": 4,
    "minPrice": 538,
    "maxPrice": 598,
    "currency": "BRL",
    "messageId": "msg_123",
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

### PRE_CHECKIN_WINDOW

Emitido X dias antes do check-in para disparar fluxos de upsell.

```json
{
  "eventId": "evt_...",
  "eventType": "PRE_CHECKIN_WINDOW",
  "conversationId": "conv_123",
  "metadata": {
    "daysToArrival": 3,
    "bookingId": "booking_123",
    "roomType": "Chale Luxo"
  }
}
```

### POST_CHECKOUT_WINDOW

Emitido após o check-out para fluxos de feedback ou pós-venda.

```json
{
  "eventId": "evt_...",
  "eventType": "POST_CHECKOUT_WINDOW",
  "conversationId": "conv_123",
  "metadata": {
    "checkoutDate": "2026-05-15"
  }
}
```

### HUMAN_TAKEOVER_STARTED

Emitido quando a automação é pausada para atendimento humano.

```json
{
  "eventId": "evt_...",
  "eventType": "HUMAN_TAKEOVER_STARTED",
  "conversationId": "conv_123",
  "metadata": {
    "actor": "atendente_1",
    "pausedUntil": "2026-05-13T23:59:59Z"
  }
}
```

### HUMAN_TAKEOVER_ENDED

Emitido quando a automação é retomada.

```json
{
  "eventId": "evt_...",
  "eventType": "HUMAN_TAKEOVER_ENDED",
  "conversationId": "conv_123",
  "metadata": {
    "reason": "Retomada manual"
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

## 3.1. Eventos operacionais e de estado

### ConversationStateChanged

Emitido quando o estado conversacional persistente muda.

```json
{
  "eventType": "ConversationStateChanged",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "previousFlow": null,
    "currentFlow": "quote",
    "previousStep": null,
    "currentStep": "collecting_dates",
    "flowData": {
      "adults": 2
    },
    "reason": "Mensagem indicou pedido de orçamento",
    "actorType": "system"
  }
}
```

Envelope atual equivalente:

```json
{
  "action": "ConversationStateChanged",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "metadata": {
    "previousFlow": null,
    "currentFlow": "quote",
    "previousStep": null,
    "currentStep": "collecting_dates",
    "flowData": {
      "adults": 2
    },
    "reason": "Mensagem indicou pedido de orçamento",
    "actorType": "system"
  }
}
```

### ReservationDraftCreated

Emitido quando o CRM cria um rascunho de reserva assistida.

```json
{
  "eventType": "ReservationDraftCreated",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "reservationDraftId": "draft_123",
    "pipelineCardId": "card_123",
    "roomTypeId": "room_1",
    "checkin": "2026-06-15",
    "checkout": "2026-06-17",
    "adults": 2,
    "children": 0,
    "estimatedValue": 538,
    "currency": "BRL",
    "status": "draft"
  }
}
```

### AutomationFailed

Emitido quando uma automação falha de forma controlada.

```json
{
  "eventType": "AutomationFailed",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "automation": "quote_flow",
    "step": "send_quote_message",
    "errorCode": "EVOLUTION_SEND_FAILED",
    "message": "Evolution API retornou erro ao enviar mensagem",
    "recoverable": true,
    "attempt": 1,
    "nextAction": "retry"
  }
}
```

Critérios:

- não deve quebrar atendimento;
- deve registrar contexto suficiente para suporte;
- não deve expor segredo/token;
- se for recuperável, deve gerar `RetryScheduled`.

### RetryScheduled

Emitido quando uma ação falha e entra em retry.

```json
{
  "eventType": "RetryScheduled",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "jobId": "job_123",
    "action": "SEND_WHATSAPP_MESSAGE",
    "attempt": 2,
    "maxAttempts": 5,
    "runAt": "2026-05-12T21:15:00.000Z",
    "backoffMs": 60000,
    "reason": "Evolution indisponível"
  }
}
```

### HumanEscalationRequested

Emitido quando automação pede intervenção humana.

```json
{
  "eventType": "HumanEscalationRequested",
  "conversationId": "conv_123",
  "contactId": "contact_123",
  "payload": {
    "reason": "Cliente pediu condição fora da regra automática",
    "priority": "high",
    "currentFlow": "quote",
    "currentStep": "negotiation",
    "lastCustomerMessage": "Consegue fazer mais barato se eu pagar pix?",
    "suggestedAction": "Atendente revisar negociação"
  }
}
```

Critérios:

- deve aparecer para operação;
- não deve continuar respondendo automaticamente sem nova regra;
- pode pausar automação temporariamente;
- deve manter contexto para o atendente.

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

URL de producao testada:

```txt
https://www.pousadadelplata.com.br/api/crm/internal-actions
```

O token deve ficar somente em variavel/credencial do n8n. Nao colocar token em node exposto ao front.

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

Exemplo real usado no workflow n8n validado:

```json
{
  "action": "SEND_WHATSAPP_MESSAGE",
  "payload": {
    "conversationId": "5ccbc27c-7b49-4370-a174-d408b44a03a7",
    "text": "Teste n8n: recebi o evento QuoteRequested e consegui responder pelo CRM."
  }
}
```

Resposta esperada:

```json
{
  "ok": true,
  "action": "SEND_WHATSAPP_MESSAGE",
  "result": {
    "conversationId": "5ccbc27c-7b49-4370-a174-d408b44a03a7",
    "messageId": "989eb09d-1517-4e57-a662-e4f0d0945e7f",
    "externalMessageId": "3EB00725C86AF4F954138F"
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

Exemplo real validado:

```json
{
  "action": "PAUSE_AUTOMATION",
  "payload": {
    "conversationId": "5ccbc27c-7b49-4370-a174-d408b44a03a7",
    "minutes": 15
  }
}
```

Resposta esperada:

```json
{
  "ok": true,
  "action": "PAUSE_AUTOMATION",
  "result": {
    "conversationId": "5ccbc27c-7b49-4370-a174-d408b44a03a7",
    "pausedUntil": "2026-05-11T16:55:34.996Z"
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

## 5. Contrato de orcamento para n8n

Endpoint:

```txt
POST /api/crm/quote
Authorization: Bearer CRM_INTERNAL_API_TOKEN
Content-Type: application/json
```

URL de producao testada:

```txt
https://www.pousadadelplata.com.br/api/crm/quote
```

Requisicao:

```json
{
  "conversationId": "5ccbc27c-7b49-4370-a174-d408b44a03a7",
  "checkin": "2026-06-15",
  "checkout": "2026-06-17",
  "adults": 2,
  "children": 0
}
```

Resposta real resumida:

```json
{
  "ok": true,
  "conversationId": "5ccbc27c-7b49-4370-a174-d408b44a03a7",
  "quote": {
    "ok": true,
    "checkin": "2026-06-15",
    "checkout": "2026-06-17",
    "nights": 2,
    "options": [
      {
        "roomTypeName": "Apartamento Anexo",
        "remainingUnits": 2,
        "totalPrice": 538
      },
      {
        "roomTypeName": "Chale",
        "remainingUnits": 2,
        "totalPrice": 558
      }
    ]
  }
}
```

O n8n deve usar essa rota para consultar disponibilidade/preco. Ele nao deve acessar Turso diretamente.

## 6. Workflow n8n validado em teste local

Webhook de entrada:

```txt
POST /webhook/crm-events
```

Variavel da Vercel:

```txt
N8N_WEBHOOK_URL=https://<tunel-publico>/webhook/crm-events
```

Fluxo minimo validado:

```txt
Webhook
  -> Filtrar QuoteRequested
  -> Enviar WhatsApp pelo CRM
```

Filtro usado:

```js
const item = $input.first();
const body = item.json.body || {};

if (body.action !== 'QuoteRequested') {
  return [];
}

return [{ json: item.json }];
```

Esse filtro evita loop: quando o CRM registra o envio feito pelo n8n, esse novo evento nao deve disparar outra resposta automatica.

## 7. Regras de segurança

- Toda ação do n8n exige token interno.
- Toda ação deve gerar log.
- Se conversa estiver pausada, n8n não deve enviar mensagem.
- Se o card não existir, retornar erro claro.
- Se stage for inválido, retornar erro claro.
- O n8n deve chamar apenas APIs do CRM. Nunca escrever direto no banco.
- Se `N8N_WEBHOOK_URL` falhar, o atendimento nao deve quebrar.
- Em teste local, manter o tunel publico aberto enquanto a Vercel chama o n8n.

## 8. Respostas padrão

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
