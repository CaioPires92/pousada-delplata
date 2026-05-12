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
CRM services
        ↓
Conversation State + Pipeline State Machine
        ↓
Prisma/Turso
        ↓
Inbox + Kanban + Logs
        ↓
Eventos internos / webhook para n8n
        ↓
n8n chama APIs internas do CRM
```

Evolução esperada:

```txt
Mensagem → identidade → conversa → estado → parser → evento → n8n → API CRM → estado/pipeline/mensagem
```

O sistema deixa de ser apenas "mensagem recebida, resposta enviada" e passa a ser orientado a estado conversacional. Cada automação deve consultar e atualizar estado antes de responder.

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
      intentParser.ts
      conversations.ts
      messages.ts
      pipeline.ts
      pipelineMachine.ts
      chatbot.ts
      events.ts
      logs.ts
      n8n.ts
      queue.ts
      observability.ts
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
currentFlow
flowStep
flowDataJson
lastAutomationAt
lastMessageAt
createdAt
updatedAt
```

`Conversation` deve guardar o estado operacional do atendimento. O objetivo é evitar perguntas repetidas, permitir retomada de fluxo e impedir que n8n responda fora de contexto.

Exemplos:

```txt
currentFlow = quote
flowStep = waiting_checkout
flowDataJson = {"checkin":"2026-06-15","adults":2}
lastAutomationAt = 2026-05-12T21:00:00.000Z
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

#### ReservationDraft

Modelo futuro para reserva assistida, antes de criar reserva real no motor:

```txt
id
conversationId
contactId
pipelineCardId
roomTypeId
checkin
checkout
adults
children
guestName
guestEmail
guestDocument
paymentPreference
status
metadataJson
createdAt
updatedAt
```

Critério de domínio: `ReservationDraft` não confirma reserva e não bloqueia inventário por si só. Ele apenas preserva contexto comercial até o humano ou um fluxo seguro avançar para reserva real.

#### PipelineStageHistory

Modelo futuro para auditoria de movimentação:

```txt
id
pipelineCardId
conversationId
fromStage
toStage
actorType
actorId
reason
metadataJson
createdAt
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

## 6.1. Conversation State

O estado conversacional é o mecanismo central para automações maduras.

Responsabilidades:

- armazenar fluxo atual;
- armazenar etapa atual;
- guardar dados parciais coletados;
- registrar última ação automatizada;
- permitir retomada depois de pausa ou queda do n8n;
- impedir loops e respostas repetidas.

Exemplo de fluxo de orçamento:

```txt
currentFlow=quote
flowStep=collecting_dates
flowDataJson={"adults":2}
```

Quando o cliente envia checkout:

```txt
currentFlow=quote
flowStep=ready_to_quote
flowDataJson={"checkin":"2026-06-15","checkout":"2026-06-17","adults":2}
```

Toda automação deve verificar:

```txt
chatbotEnabled
automationPausedUntil
currentFlow
flowStep
lastAutomationAt
```

## 6.2. Pipeline State Machine

O pipeline deve ser orientado por transições válidas, não por atualização livre de string.

Criar serviço futuro:

```txt
src/lib/crm/pipelineMachine.ts
```

Responsabilidades:

- validar transições;
- impedir saltos inválidos;
- registrar motivo;
- registrar ator;
- emitir eventos;
- criar histórico.

Exemplo:

```txt
NOVO_LEAD → QUALIFICANDO
QUALIFICANDO → CONSULTANDO_DISPONIBILIDADE
CONSULTANDO_DISPONIBILIDADE → ORCAMENTO_ENVIADO
ORCAMENTO_ENVIADO → AGUARDANDO_RESPOSTA
AGUARDANDO_RESPOSTA → RESERVA_EM_ANDAMENTO
```

Transições como `NOVO_LEAD → PAGAMENTO_PENDENTE` devem ser recusadas, salvo override administrativo explicitamente registrado.

## 6.3. Retry Queue e Dead Letter

Automação e envio de WhatsApp não devem depender apenas do sucesso imediato da requisição.

Design futuro:

```txt
InternalActionLog / AutomationJob
        ↓
Queue
        ↓
Worker
        ↓
Retry exponencial
        ↓
Dead Letter se falhar definitivamente
```

Critérios:

- envio WhatsApp pode falhar sem perder contexto;
- n8n pode cair sem quebrar atendimento;
- jobs devem ter status;
- replay manual deve ser possível para dead letters;
- processamento deve ser serial por conversa quando envolver resposta ao cliente.

## 6.4. Redis futuro

Redis não é fonte de verdade. Deve ser usado apenas para mecanismos temporários:

```txt
locks
debounce
cache
rate limit
fila futura
```

Casos esperados:

- lock por conversa durante cotação;
- debounce de múltiplas mensagens em poucos segundos;
- rate limit de automações;
- cache curto de disponibilidade quando seguro;
- evitar que dois workers respondam ao mesmo cliente ao mesmo tempo.

Se Redis estiver indisponível, o sistema deve degradar de forma segura e nunca perder dados permanentes.

## 6.5. Observabilidade

O CRM precisa de observabilidade operacional antes de automação complexa.

Componentes futuros:

```txt
/admin/crm/events
/admin/crm/dashboard
structured logs
operational alerts
```

Eventos e logs devem permitir responder:

- qual evento chegou?
- qual automação rodou?
- n8n recebeu?
- WhatsApp enviou?
- qual erro ocorreu?
- houve retry?
- houve handoff humano?

Categorias recomendadas:

```txt
INFO
WARN
ERROR
AUTOMATION
SECURITY
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

### Orçamento interno

#### `POST /api/crm/quote`

Consulta disponibilidade e preço através do domínio do motor, sem criar reserva.

Responsabilidades:

- validar token interno;
- validar conversa;
- validar datas e hóspedes;
- chamar serviço de disponibilidade/preço;
- registrar `QuoteRequested`;
- retornar opções ordenadas;
- não bloquear inventário.

### Ações internas

#### `POST /api/crm/internal-actions`

Endpoint para ações do n8n.

Responsabilidades:

- validar token interno;
- validar payload;
- executar via serviços do CRM;
- registrar log;
- nunca permitir escrita direta do n8n no banco.

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
- `POST /api/crm/internal-actions`
- `POST /api/crm/quote`
- `PATCH /api/crm/chatbot/[conversationId]`

Fluxo de orçamento esperado:

```txt
MessageReceived
        ↓
CRM parser/estado detecta dados suficientes
        ↓
QuoteRequested
        ↓
n8n chama /api/crm/quote
        ↓
n8n chama /api/crm/internal-actions SEND_WHATSAPP_MESSAGE
        ↓
CRM registra mensagem, QuoteSent e movimenta pipeline
```

O n8n deve ser stateless sempre que possível. O estado durável fica no CRM (`Conversation`, `PipelineCard`, `ReservationDraft`, logs).

## 10. Segurança

- Evolution API Key via `.env`.
- Webhook secret opcional via `.env`.
- n8n deve usar token interno.
- Nenhum segredo hardcoded.
- Logs não devem expor dados sensíveis desnecessários.
- Rate limit interno antes de automações em escala.
- Auditoria administrativa para ações humanas e automáticas.

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
- Fluxos de automação devem ser orientados por estado persistente em `Conversation`.
- Reserva assistida usa `ReservationDraft` antes de reserva real.
- Redis futuro é apoio operacional, não banco primário.
- Fila/retry devem existir antes de reserva automática.
- **GUARDRAIL:** O módulo CRM é isolado. Não modificar lógica de preços, disponibilidade ou reserva do motor principal.
- **GUARDRAIL:** Banco de Produção (Turso) é protegido. Proibido comandos de reset ou alterações destrutivas em tabelas legadas.
