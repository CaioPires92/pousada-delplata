# Design Doc — CRM WhatsApp Delplata

## 1. Contexto

O projeto `Delplata-Motor` já possui um motor de reservas. O CRM WhatsApp deve ser adicionado como módulo paralelo, sem alterar o funcionamento principal do motor.

O CRM será responsável por atendimento, histórico, pipeline e preparação para automações. O motor de reservas continuará responsável por disponibilidade, tarifas, reservas e pagamentos.

## 2. Stack

- Next.js App Router
- TypeScript
- Prisma ORM
- SQLite/Turso via LibSQL
- Evolution API para WhatsApp
- n8n futuramente para orquestração

## 3. Arquitetura lógica

```txt
WhatsApp Evolution API
        ↓
/api/whatsapp/webhook
        ↓
src/lib/crm/services
        ↓
Prisma/Turso
        ↓
Inbox + Kanban + Logs
        ↓
Eventos internos / webhook para n8n
        ↓
n8n chama APIs internas do CRM
```

## 4. Princípio de domínio

O CRM é o dono dos dados comerciais de atendimento.

O n8n é apenas orquestrador.

Errado:

```txt
n8n → banco direto
```

Certo:

```txt
n8n → API CRM → validação → banco → log
```

## 5. Estrutura de pastas recomendada

```txt
src/
  app/
    api/
      crm/
        conversations/
          route.ts
          [id]/
            route.ts
        pipeline/
          route.ts
          cards/
            [id]/
              route.ts
        chatbot/
          [conversationId]/
            route.ts
        events/
          route.ts
        internal-actions/
          route.ts
      whatsapp/
        webhook/
          route.ts
        send/
          route.ts
    admin/
      inbox/
        page.tsx
        [id]/
          page.tsx
      kanban/
        page.tsx
  components/
    crm/
      ConversationList.tsx
      ConversationView.tsx
      MessageBubble.tsx
      ReplyBox.tsx
      ChatbotToggle.tsx
      KanbanBoard.tsx
      KanbanCard.tsx
  lib/
    crm/
      identity.ts
      conversations.ts
      messages.ts
      pipeline.ts
      chatbot.ts
      events.ts
      logs.ts
      n8n.ts
    whatsapp/
      evolution.ts
    prisma.ts
```

## 6. Banco de dados

### Modelos principais

- `Contact`
- `Conversation`
- `Message`
- `PipelineCard`
- `ChatbotSettings`
- `InternalActionLog`

### Campos recomendados adicionais

#### Contact

```prisma
model Contact {
  id        String   @id @default(cuid())
  name      String?
  phone     String?  @unique
  whatsappJid String? @unique
  lid       String?  @unique
  source    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Observação: ajustar ao schema real existente antes de aplicar migration. Não duplicar campos já existentes.

#### Conversation

Campos recomendados:

```txt
id
contactId
channel
status
chatbotEnabled
automationPausedUntil
lastMessageAt
createdAt
updatedAt
```

#### Message

Campos recomendados:

```txt
id
conversationId
contactId
channel
direction
type
text
mediaUrl
externalId
status
createdAt
sentAt
receivedAt
```

#### PipelineCard

Campos recomendados:

```txt
id
contactId
conversationId
stage
title
estimatedValue
intendedCheckin
intendedCheckout
adults
children
roomTypeInterest
lostReason
source
createdAt
updatedAt
```

#### InternalActionLog

Campos recomendados:

```txt
id
entityType
entityId
action
actorType
actorId
metadataJson
createdAt
```

## 7. Rotas API

### WhatsApp

#### `POST /api/whatsapp/webhook`

Recebe payload da Evolution API.

Responsabilidades:

- validar segredo opcional;
- ignorar mensagens `fromMe` quando apropriado;
- extrair identidade;
- criar/atualizar contato;
- criar/reutilizar conversa;
- salvar mensagem;
- criar card se não existir;
- emitir evento interno;
- responder sempre com JSON previsível.

#### `POST /api/whatsapp/send`

Envia mensagem manual pelo CRM.

Payload:

```json
{
  "conversationId": "string",
  "text": "string"
}
```

Responsabilidades:

- validar conversa;
- localizar contato/telefone;
- enviar pela Evolution API;
- salvar mensagem outbound;
- atualizar conversa;
- pausar automação;
- registrar log.

### CRM Conversas

#### `GET /api/crm/conversations`

Lista conversas ordenadas por `lastMessageAt`.

#### `GET /api/crm/conversations/[id]`

Retorna conversa, contato e mensagens.

### CRM Pipeline

#### `GET /api/crm/pipeline`

Retorna cards agrupados por estágio.

#### `PATCH /api/crm/pipeline/cards/[id]`

Atualiza estágio e campos comerciais.

Payload exemplo:

```json
{
  "stage": "ORCAMENTO_ENVIADO",
  "reason": "Cliente recebeu orçamento pelo WhatsApp"
}
```

### Chatbot

#### `PATCH /api/crm/chatbot/[conversationId]`

Liga/desliga automação por conversa.

Payload:

```json
{
  "chatbotEnabled": false,
  "reason": "Humano assumiu a conversa"
}
```

### Eventos internos

#### `POST /api/crm/events`

Endpoint interno para registrar eventos e, futuramente, disparar n8n.

## 8. Componentes Frontend

### Inbox

Componentes:

- `ConversationList`
- `ConversationView`
- `MessageBubble`
- `ReplyBox`
- `ChatbotToggle`

Requisitos:

- polling inicial a cada 3 segundos;
- scroll automático ao final;
- estado de envio;
- tratamento de erro;
- não duplicar mensagem otimista quando API retornar.

### Kanban

Componentes:

- `KanbanBoard`
- `KanbanColumn`
- `KanbanCard`

Requisitos:

- listar cards por estágio;
- mover manualmente;
- salvar alteração via API;
- registrar motivo ou ação;
- preparar para atualização automática via evento/n8n.

## 9. Integração com n8n

O n8n deve receber eventos do CRM ou consultar periodicamente eventos pendentes.

Eventos possíveis:

```txt
MessageReceived
LeadCreated
QualificationUpdated
QuoteRequested
QuoteSent
ReservationStarted
PaymentPending
ReservationConfirmed
HumanTookOver
AutomationPaused
LeadLost
```

O n8n pode chamar:

- `PATCH /api/crm/pipeline/cards/[id]`
- `POST /api/whatsapp/send`
- `PATCH /api/crm/chatbot/[conversationId]`
- endpoints futuros de disponibilidade/orçamento.

## 10. Segurança

- Evolution API Key via `.env`.
- Webhook secret opcional via `.env`.
- n8n deve usar token interno.
- Nenhum segredo hardcoded.
- Logs não devem expor dados sensíveis desnecessários.

## 11. Variáveis de ambiente

```env
DATABASE_URL=
DATABASE_AUTH_TOKEN=
EVOLUTION_API_BASE_URL=http://localhost:8080
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=delplata2026
EVOLUTION_WEBHOOK_SECRET=
CRM_INTERNAL_API_TOKEN=
N8N_WEBHOOK_URL=
```

## 12. Decisões técnicas travadas

- CRM é módulo paralelo.
- n8n não escreve direto no banco.
- Kanban é atualizado por API/eventos.
- LID não é telefone.
- Primeiro polling, depois realtime se necessário.
- UI operacional antes de UI premium.
- Logs antes de automação complexa.
- **GUARDRAIL:** O módulo CRM é isolado. Não modificar lógica de preços, disponibilidade ou reserva do motor principal.
- **GUARDRAIL:** Banco de Produção (Turso) é protegido. Proibido comandos de reset ou alterações destrutivas em tabelas legadas.
