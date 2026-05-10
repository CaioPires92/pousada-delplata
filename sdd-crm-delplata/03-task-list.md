# Task List — CRM WhatsApp Delplata

## Status atual considerado

Já concluído até a Tarefa 7 do ciclo anterior:

- base Prisma CRM;
- webhook WhatsApp;
- inbox inicial;
- detalhe de conversa;
- envio via Evolution API;
- resposta manual;
- chatbot básico/controlado;
- Kanban inicial;
- campos comerciais básicos.

A partir daqui, o foco é transformar o CRM em uma base sólida para automação futura com n8n.

---

# Fase 8 — Identidade WhatsApp e LID

## Task 8.1 — Criar helper central de identidade

Criar arquivo:

```txt
src/lib/crm/identity.ts
```

Funções mínimas:

```ts
extractWhatsAppIdentity(payload: unknown): WhatsAppIdentity
normalizeBrazilianPhone(input: string): string | null
isLid(jid: string): boolean
isWhatsappPhoneJid(jid: string): boolean
```

Critérios:

- detectar `@lid`;
- detectar `@s.whatsapp.net`;
- não salvar LID como telefone;
- normalizar telefone BR quando possível;
- retornar objeto previsível mesmo com payload incompleto.

## Task 8.2 — Ajustar Contact para suportar LID/JID

Verificar schema real antes de alterar.

Campos desejados, se ainda não existirem:

```txt
phone
whatsappJid
lid
```

Critérios:

- `phone` único quando existir;
- `lid` único quando existir;
- `whatsappJid` único quando existir;
- migration aditiva;
- não alterar tabelas antigas do motor.

## Task 8.3 — Atualizar webhook para usar helper

Critérios:

- webhook não deve conter parsing espalhado;
- usar `identity.ts`;
- manter compatibilidade com payload atual da Evolution;
- logs para casos sem telefone real.

---

# Fase 9 — Eventos internos

## Task 9.1 — Criar serviço de eventos

Criar:

```txt
src/lib/crm/events.ts
```

Funções:

```ts
recordCrmEvent(input)
emitCrmEvent(input)
```

Critérios:

- registrar evento no `InternalActionLog` ou tabela específica futura;
- payload JSON serializável;
- não quebrar fluxo se n8n estiver offline.

## Task 9.2 — Emitir evento MessageReceived

Quando webhook receber mensagem válida:

```txt
MessageReceived
```

Payload mínimo:

```json
{
  "conversationId": "...",
  "contactId": "...",
  "messageId": "...",
  "channel": "whatsapp",
  "text": "..."
}
```

## Task 9.3 — Emitir evento LeadCreated

Quando card for criado automaticamente:

```txt
LeadCreated
```

Critérios:

- não emitir duplicado para card já existente;
- registrar estágio inicial.

---

# Fase 10 — API sólida do Kanban

## Task 10.1 — Padronizar estágios

Criar enum ou constante central:

```txt
src/lib/crm/pipelineStages.ts
```

Estágios:

```txt
NOVO_LEAD
QUALIFICANDO
CONSULTANDO_DISPONIBILIDADE
ORCAMENTO_ENVIADO
AGUARDANDO_RESPOSTA
RESERVA_EM_ANDAMENTO
PAGAMENTO_PENDENTE
RESERVA_CONFIRMADA
HOSPEDADO
POS_VENDA
PERDIDO
```

## Task 10.2 — Criar PATCH de card

Rota:

```txt
PATCH /api/crm/pipeline/cards/[id]
```

Payload:

```json
{
  "stage": "ORCAMENTO_ENVIADO",
  "reason": "Orçamento enviado pelo WhatsApp"
}
```

Critérios:

- validar stage;
- atualizar card;
- registrar log;
- emitir evento `PipelineStageChanged`;
- aceitar futura chamada do n8n com token interno.

## Task 10.3 — Criar update comercial parcial

Permitir atualizar:

```txt
estimatedValue
intendedCheckin
intendedCheckout
adults
children
roomTypeInterest
lostReason
```

Critérios:

- update parcial;
- validação defensiva;
- log de alteração.

---

# Fase 11 — Pausa real de automação

## Task 11.1 — Adicionar `automationPausedUntil`

Adicionar em `Conversation`, se ainda não existir.

Critérios:

- migration aditiva;
- nullable;
- usado pelo envio manual e pelo chatbot.

## Task 11.2 — Pausar ao responder manualmente

No endpoint:

```txt
POST /api/whatsapp/send
```

Ao enviar mensagem manual:

```txt
automationPausedUntil = now + 30 min
chatbotEnabled = false ou pausa temporária, conforme regra escolhida
```

Critérios:

- registrar `HumanTookOver`;
- registrar `AutomationPaused`.

## Task 11.3 — Impedir bot em conversa pausada

Antes de qualquer automação responder:

- verificar `chatbotEnabled`;
- verificar `automationPausedUntil`;
- se pausada, não enviar.

---

# Fase 12 — Contrato n8n

## Task 12.1 — Criar token interno

Variável:

```env
CRM_INTERNAL_API_TOKEN=
```

Critérios:

- endpoints internos exigem bearer token;
- não expor no front.

## Task 12.2 — Criar endpoint para receber ação do n8n

Rota:

```txt
POST /api/crm/internal-actions
```

Ações aceitas inicialmente:

```txt
MOVE_PIPELINE_CARD
SEND_WHATSAPP_MESSAGE
PAUSE_AUTOMATION
UPDATE_LEAD_FIELDS
```

Critérios:

- validar token;
- validar payload;
- executar via serviços internos;
- registrar log;
- retornar JSON previsível.

## Task 12.3 — Criar documentação de payloads

Atualizar:

```txt
05-event-contracts.md
```

Com exemplos reais para n8n.

---

# Fase 13 — Inbox operacional

## Task 13.1 — Melhorar layout da conversa

Critérios:

- bolhas esquerda/direita;
- scroll no final;
- textarea fixa;
- loading state;
- erro visível.

## Task 13.2 — Polling controlado

Critérios:

- atualizar conversa a cada 3 segundos;
- evitar duplicar mensagens;
- pausar polling quando aba não estiver ativa, se simples de implementar;
- manter código simples.

## Task 13.3 — Preview consistente

Critérios:

- última mensagem aparece na lista;
- envio manual atualiza preview;
- recebimento atualiza preview;
- ordenar por `lastMessageAt`.

---

# Fase 14 — Integração futura com disponibilidade/preço

## Task 14.1 — Criar interface de consulta

Criar serviço:

```txt
src/lib/crm/availabilityQuote.ts
```

Ainda sem IA.

Objetivo:

- preparar contrato para consultar disponibilidade/preço no banco do motor;
- não consultar Hospedin direto em tempo real.

## Task 14.2 — Endpoint de orçamento interno

Rota futura:

```txt
POST /api/crm/quote
```

Payload:

```json
{
  "conversationId": "...",
  "checkin": "2026-06-15",
  "checkout": "2026-06-17",
  "adults": 2,
  "children": 1
}
```

Critérios:

- retornar opções disponíveis;
- não criar reserva ainda;
- registrar `QuoteRequested`.

---

# Fase 15 — Hardening

## Task 15.1 — Testar duplicidade

Testar:

- mesma mensagem recebida duas vezes;
- dois webhooks simultâneos;
- contato com telefone;
- contato com LID;
- mensagem sem texto;
- mídia.

## Task 15.2 — Logs de erro

Critérios:

- falha da Evolution API salva log;
- falha do n8n não quebra atendimento;
- erro visível no front quando envio falhar.

## Task 15.3 — Checklist de produção local

Validar comandos:

```bash
npm run prisma:generate
npm run typecheck
npm run lint
npm run dev
```

Se algum falhar por erro pré-existente, documentar exatamente qual.

---

# Regra para execução por IA/Codex

Executar uma task por vez.

Ao final de cada task, reportar:

```txt
Arquivos alterados
O que foi feito
Como testar
Comandos executados
Pendências
```

Não avançar para a próxima task sem validar a anterior.
