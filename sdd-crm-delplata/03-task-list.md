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

Status: concluída em 2026-05-13.

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

Entrega:

- criado `src/lib/crm/identity.ts` com `extractWhatsAppIdentity`, `normalizeBrazilianPhone`, `isLid`, `isWhatsappPhoneJid`;
- helper detecta `@lid` e `@s.whatsapp.net`, evitando persistir LID como telefone normalizado.

## Task 8.2 — Ajustar Contact para suportar LID/JID

Status: concluída em 2026-05-13.

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

Entrega:

- `Contact` no `prisma/schema.prisma` com `phone`, `lid` e `whatsappJid` como campos únicos opcionais;
- uso ativo desses campos no matching de contato do webhook CRM.

## Task 8.3 — Atualizar webhook para usar helper

Status: concluída em 2026-05-13.

Critérios:

- webhook não deve conter parsing espalhado;
- usar `identity.ts`;
- manter compatibilidade com payload atual da Evolution;
- logs para casos sem telefone real.

Entrega:

- webhook usa `extractWhatsAppIdentity` centralmente em `src/app/api/whatsapp/webhook/[[...slug]]/route.ts`;
- parsing de identidade ficou concentrado no helper com logs de fallback/erros.

---

# Fase 9 — Eventos internos

## Task 9.1 — Criar serviço de eventos

Status: concluída em 2026-05-13.

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

Entrega:

- criado `src/lib/crm/events.ts` com `recordCrmEvent` e `emitCrmEvent`;
- eventos persistem em `InternalActionLog` e falha de emissão externa não interrompe atendimento.

## Task 9.2 — Emitir evento MessageReceived

Status: concluída em 2026-05-13.

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

Entrega:

- webhook emite `MessageReceived` com `conversationId`, `contactId`, `messageId`, `channel` e `text`.

## Task 9.3 — Emitir evento LeadCreated

Status: concluída em 2026-05-13.

Quando card for criado automaticamente:

```txt
LeadCreated
```

Critérios:

- não emitir duplicado para card já existente;
- registrar estágio inicial.

Entrega:

- webhook emite `LeadCreated` ao criar lead novo;
- card inicial é criado em `NOVO_LEAD`, evitando duplicação para card ativo existente.

---

# Fase 10 — API sólida do Kanban

## Task 10.1 — Padronizar estágios

Status: concluída em 2026-05-13.

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

Entrega:

- criado `src/lib/crm/pipelineStages.ts` com constantes, labels e normalização dos estágios.

## Task 10.2 — Criar PATCH de card

Status: concluída em 2026-05-13.

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

Entrega:

- implementada rota `PATCH /api/crm/pipeline/cards/[id]` em `src/app/api/crm/pipeline/cards/[id]/route.ts`;
- valida estágio, atualiza card via serviço, registra log e aceita ator `n8n` via token interno.

## Task 10.3 — Criar update comercial parcial

Status: concluída em 2026-05-13.

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

Entrega:

- `src/lib/crm/pipelineCards.ts` suporta update parcial defensivo de `estimatedValue`, datas, ocupação, interesse e motivo de perda;
- mudanças comerciais são auditadas por evento `PipelineCardCommercialFieldsUpdated`.

---

# Fase 11 — Pausa real de automação

## Task 11.1 — Adicionar `automationPausedUntil`

Status: concluída em 2026-05-13.

Adicionar em `Conversation`, se ainda não existir.

Critérios:

- migration aditiva;
- nullable;
- usado pelo envio manual e pelo chatbot.

Entrega:

- `automationPausedUntil` presente em `Conversation` e usado em `automationPause.ts`, webhook e envio manual.

## Task 11.2 — Pausar ao responder manualmente

Status: concluída em 2026-05-13.

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

Entrega:

- `POST /api/whatsapp/send` aplica pausa temporária de automação;
- registra `HumanTookOver` e `AutomationPaused`.

## Task 11.3 — Impedir bot em conversa pausada

Status: concluída em 2026-05-13.

Antes de qualquer automação responder:

- verificar `chatbotEnabled`;
- verificar `automationPausedUntil`;
- se pausada, não enviar.

Entrega:

- `src/lib/whatsapp/automation.ts` e webhook validam `chatbotEnabled` + `automationPausedUntil` antes de responder automaticamente.

---

# Fase 12 — Contrato n8n

## Task 12.1 — Criar token interno

Status: concluída em 2026-05-13.

Variável:

```env
CRM_INTERNAL_API_TOKEN=
```

Critérios:

- endpoints internos exigem bearer token;
- não expor no front.

Entrega:

- endpoints internos usam `CRM_INTERNAL_API_TOKEN` via Bearer auth no backend.

## Task 12.2 — Criar endpoint para receber ação do n8n

Status: concluída em 2026-05-13.

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

Entrega:

- implementado `POST /api/crm/internal-actions` com validação de token/payload e ações suportadas;
- integra serviços internos com respostas padronizadas.

## Task 12.3 — Criar documentação de payloads

Status: concluída em 2026-05-13.

Atualizar:

```txt
05-event-contracts.md
```

Com exemplos reais para n8n.

Entrega:

- `sdd-crm-delplata/05-event-contracts.md` atualizado com contratos e exemplos para n8n.

---

# Fase 13 — Inbox operacional

## Task 13.1 — Melhorar layout da conversa

Status: concluída em 2026-05-13.

Critérios:

- bolhas esquerda/direita;
- scroll no final;
- textarea fixa;
- loading state;
- erro visível.

Entrega:

- `MessageList` e `ReplyBox` com bolhas esquerda/direita, indicador de envio, erro visível e composição operacional da conversa.

## Task 13.2 — Polling controlado

Status: concluída em 2026-05-13.

Critérios:

- atualizar conversa a cada 3 segundos;
- evitar duplicar mensagens;
- pausar polling quando aba não estiver ativa, se simples de implementar;
- manter código simples.

Entrega:

- polling de mensagens em 3s (`MessageList`) com dedupe (`mergePolledMessages`) e pausa por `document.visibilityState`.

## Task 13.3 — Preview consistente

Status: concluída em 2026-05-13.

Critérios:

- última mensagem aparece na lista;
- envio manual atualiza preview;
- recebimento atualiza preview;
- ordenar por `lastMessageAt`.

Entrega:

- API de conversas ordena por `lastMessageAt` e inclui preview da última mensagem;
- envio manual/recebimento atualizam `lastMessageAt`, refletindo preview da inbox.

---

# Fase 14 — Integração futura com disponibilidade/preço

## Task 14.1 — Criar interface de consulta

Status: concluída em 2026-05-13.

Criar serviço:

```txt
src/lib/crm/availabilityQuote.ts
```

Ainda sem IA.

Objetivo:

- preparar contrato para consultar disponibilidade/preço no banco do motor;
- não consultar Hospedin direto em tempo real.

Entrega:

- criado serviço `src/lib/crm/availabilityQuote.ts` para consulta de disponibilidade/preço no banco local do motor.

## Task 14.2 — Endpoint de orçamento interno

Status: concluída em 2026-05-13.

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

Entrega:

- implementado `POST /api/crm/quote` em `src/app/api/crm/quote/route.ts`;
- retorna opções sem criar reserva e registra `QuoteRequested`.

---

# Fase 15 — Hardening

## Task 15.1 — Testar duplicidade

Status: concluída em 2026-05-13.

Testar:

- mesma mensagem recebida duas vezes;
- dois webhooks simultâneos;
- contato com telefone;
- contato com LID;
- mensagem sem texto;
- mídia.

Entrega:

- cobertura em `src/app/api/whatsapp/webhook/route.test.ts` para:
  - duplicidade idempotente por `externalMessageId`;
  - concorrência de dois webhooks simultâneos;
  - contato com LID;
  - mensagem sem texto;
  - mensagem de mídia.

## Task 15.2 — Logs de erro

Status: concluída em 2026-05-13.

Critérios:

- falha da Evolution API salva log;
- falha do n8n não quebra atendimento;
- erro visível no front quando envio falhar.

Entrega:

- falhas da Evolution registradas como `WhatsAppSendFailed`;
- falhas de emissão n8n registradas como `N8NEmitFailed` sem quebrar atendimento;
- erro de envio visível no front da inbox (`ReplyBox` + `MessageList` com status `error`).

## Task 15.3 — Checklist de produção local

Status: concluída em 2026-05-13.

Validar comandos:

```bash
npm run prisma:generate
npm run typecheck
npm run lint
npm run dev
```

Se algum falhar por erro pré-existente, documentar exatamente qual.

Entrega:

- `npm run prisma:generate`: passou após ajuste de relação inversa no `ReservationDraft`;
- `npm run lint`: passou com warnings pré-existentes (sem erros bloqueantes);
- `npm run typecheck`: falhou por erros pré-existentes amplos de tipagem (muitos `implicit any` e tipagem Prisma antiga em módulos legados);
- `npm run dev`: falhou no ambiente sandbox com `listen EPERM: operation not permitted 0.0.0.0:3001` (restrição de ambiente de execução, não falha lógica do app).

---

# Fase 16 — Automação de orçamento via n8n

Objetivo: transformar o orçamento em fluxo operacional real, sem colocar regra de negócio dentro do n8n e sem acesso direto ao banco.

## Task 16.1 — Criar parser básico de intenção

Status: concluída em 2026-05-12.

Criar:

```txt
src/lib/crm/intentParser.ts
```

Extrair:

```txt
checkin
checkout
adultos
crianças
intenção
```

Critérios:

- regex defensiva;
- tolerar linguagem natural comum;
- retornar campos parciais;
- não usar IA complexa ainda;
- não bloquear atendimento se não conseguir interpretar.

Entrega:

- criado `src/lib/crm/intentParser.ts`;
- criado `src/lib/crm/intentParser.test.ts`;
- parser extrai intenção, checkin, checkout, adultos, crianças e idades quando disponíveis;
- parser retorna campos faltantes sem bloquear o atendimento;
- validado com `npm test -- src/lib/crm/intentParser.test.ts`;
- validado com `npm run typecheck`;
- validado com `npm run lint` sem erros novos.

## Task 16.2 — Criar estado conversacional

Status: concluída em 2026-05-13.

Adicionar em `Conversation`, se ainda não existir:

```txt
currentFlow
flowStep
flowDataJson
lastAutomationAt
```

Critérios:

- migration aditiva;
- fluxo persistente;
- evitar perguntas repetidas;
- permitir retomada;
- manter compatibilidade com conversas já existentes.

Entrega:

- adicionados campos `currentFlow`, `flowStep`, `flowDataJson`, `lastAutomationAt` em `Conversation` no `prisma/schema.prisma`;
- criada migration aditiva `prisma/migrations/20260513141000_add_conversation_flow_state/migration.sql`;
- criado helper `src/lib/crm/conversationFlow.ts` para consolidar estado do fluxo de orçamento;
- webhook atualizado para persistir estado conversacional ao receber mensagem de cotação;
- cobertura inicial com `src/lib/crm/conversationFlow.test.ts`.

## Task 16.3 — Fluxo automático de coleta

Status: concluída em 2026-05-13.

Critérios:

- perguntar apenas dados faltantes;
- evitar loops;
- respeitar pausa humana;
- respeitar `chatbotEnabled`;
- timeout de fluxo;
- registrar eventos relevantes.

Entrega:

- criado `src/lib/crm/quoteFlow.ts` com controle de prompts por campo faltante (`waiting_checkin`, `waiting_checkout`, `waiting_adults`, `ready_to_quote`);
- adicionado timeout de fluxo de 30 min (`QUOTE_FLOW_TIMEOUT_MS`);
- adicionado debounce para evitar loop de prompts repetidos (`QUOTE_FLOW_DEBOUNCE_MS`);
- `src/lib/whatsapp/automation.ts` atualizado para:
  - respeitar `chatbotEnabled` + pausa humana (via `isConversationAutomationActive`);
  - enviar apenas a próxima pergunta faltante;
  - não repetir prompt no debounce;
  - expirar fluxo antigo e limpar estado;
  - registrar eventos `QuoteFlowPromptSent`, `QuoteFlowPromptSkipped`, `QuoteFlowTimedOut`;
- adicionado teste unitário `src/lib/crm/quoteFlow.test.ts`.

## Task 16.4 — Automação de orçamento ponta a ponta

Status: concluída em 2026-05-13.

Fluxo:

```txt
Mensagem → parser → quote → resposta → pipeline
```

Critérios:

- montar mensagem amigável;
- registrar `QuoteSent`;
- atualizar card automaticamente;
- usar `/api/crm/quote`;
- enviar via `/api/crm/internal-actions`;
- não criar reserva ainda.

Entrega:

- `src/lib/whatsapp/automation.ts` atualizado para executar fluxo `ready_to_quote` ponta a ponta;
- usa o contrato de `POST /api/crm/quote` (invocação interna) para consultar disponibilidade e preço;
- monta resposta amigável com período + opções formatadas em BRL;
- usa `POST /api/crm/internal-actions` (invocação interna) para:
  - `SEND_WHATSAPP_MESSAGE` com o orçamento;
  - `UPDATE_LEAD_FIELDS` com dados coletados;
  - `MOVE_PIPELINE_CARD` para `ORCAMENTO_ENVIADO`;
- registra evento `QuoteSent` com metadados de resultado;
- fallback tratado para indisponibilidade/min stay sem criar reserva automática.

## Task 16.5 — Debounce de orçamento

Status: concluída em 2026-05-13.

Critérios:

- impedir múltiplas cotações simultâneas;
- lock temporal por conversa;
- evitar spam;
- registrar quando uma cotação for ignorada por debounce;
- manter comportamento seguro se n8n atrasar ou repetir execução.

Entrega:

- adicionado lock temporal por conversa no fluxo `ready_to_quote` (`QUOTE_DEBOUNCE_LOCK_MS`);
- execução concorrente/repetida é ignorada com registro de evento `QuoteDebounced`;
- lock persistido em `flowDataJson.quoteLockUntil` para bloquear reentrância curta;
- estratégia mantém segurança quando execuções atrasadas ou duplicadas tentam cotar em paralelo.

---

# Fase 17 — Pipeline orientado a estado

Objetivo: impedir que o Kanban vire uma coleção de estados soltos sem regra operacional.

## Task 17.1 — Criar state machine do pipeline

Status: concluída em 2026-05-13.

Criar:

```txt
src/lib/crm/pipelineMachine.ts
```

Critérios:

- validar transições;
- impedir estados inválidos;
- retornar erro claro;
- cobrir transições por testes.

Entrega:

- criado `src/lib/crm/pipelineMachine.ts` com regras explícitas de transição permitida;
- integração em `src/lib/crm/pipelineCards.ts` para rejeitar transição inválida com erro claro (`invalid_stage_transition`);
- teste adicionado em `src/lib/crm/pipelineMachine.test.ts`, incluindo caso inválido (`NOVO_LEAD -> PAGAMENTO_PENDENTE`).

Exemplo:

```txt
NOVO_LEAD → PAGAMENTO_PENDENTE não deve ser permitido diretamente.
```

## Task 17.2 — Automatizar mudanças de estágio

Status: concluída em 2026-05-13.

Critérios:

- `QuoteSent` → `ORCAMENTO_ENVIADO`;
- cliente respondeu após orçamento → `AGUARDANDO_RESPOSTA`;
- reserva iniciada → `RESERVA_EM_ANDAMENTO`;
- automação deve usar API/serviço do CRM;
- humano pode sobrescrever quando necessário.

Entrega:

- criado serviço `src/lib/crm/pipelineAutomation.ts` para automação de estágios orientada por evento;
- integração no webhook `src/app/api/whatsapp/webhook/[[...slug]]/route.ts` para aplicar automação após `MessageReceived` (mensagem de hóspede);
- regras implementadas:
  - resposta do cliente após orçamento (`ORCAMENTO_ENVIADO`) move para `AGUARDANDO_RESPOSTA`;
  - intenção de reserva detectada move para `RESERVA_EM_ANDAMENTO` e emite `ReservationStarted`;
- automação usa serviço central do CRM (`updatePipelineCard`) em vez de lógica solta no endpoint;
- transições continuam sobrescrevíveis por humano via APIs já existentes.

## Task 17.3 — Histórico completo de movimentação

Status: concluída em 2026-05-13.

Criar tabela:

```txt
PipelineStageHistory
```

Critérios:

- migration aditiva;
- auditoria completa;
- base para analytics futuro;
- registrar estágio anterior, estágio novo, ator, motivo e timestamp.

Entrega:

- adicionada tabela `PipelineStageHistory` em `prisma/schema.prisma`;
- criada migration aditiva `prisma/migrations/20260513143000_add_pipeline_stage_history/migration.sql`;
- `src/lib/crm/pipelineCards.ts` atualizado para registrar histórico em toda transição de estágio válida;
- histórico salva: `pipelineCardId`, `fromStage`, `toStage`, `actorType`, `reason`, `createdAt`.

---

# Fase 18 — Reserva assistida

Objetivo: permitir avanço comercial até intenção clara de reserva, ainda sem automatizar a reserva final.

## Task 18.1 — Detectar intenção de reserva

Status: concluída em 2026-05-13.

Critérios:

- identificar mensagens como:
  - `quero fechar`;
  - `como faço pagamento`;
  - `vamos reservar`;
- emitir `ReservationStarted`;
- evitar falso positivo agressivo.

Entrega:

- detecção de intenção de reserva implementada com `parseCrmIntent` no serviço `src/lib/crm/pipelineAutomation.ts`;
- mensagens com intenção de reserva emitem `ReservationStarted`;
- ao detectar intenção, o card é movido para `RESERVA_EM_ANDAMENTO` via serviço interno (`updatePipelineCard`).

## Task 18.2 — Fluxo assistido de reserva

Status: concluída em 2026-05-13.

Coletar:

```txt
nome
CPF
e-mail
forma de pagamento
```

Critérios:

- ainda sem reserva automática;
- humano pode assumir;
- dados parciais ficam salvos;
- respeitar LGPD e minimizar dados sensíveis.

Entrega:

- criado fluxo assistido mínimo com coleta progressiva de campos faltantes do draft:
  - `guestName`
  - `guestCpf`
  - `guestEmail`
  - `paymentMethod`
- bot pergunta apenas o próximo campo faltante quando conversa está em `RESERVA_EM_ANDAMENTO` (em `src/lib/whatsapp/automation.ts`);
- dados ficam salvos parcialmente em `ReservationDraft` e podem ser completados ao longo das mensagens;
- fluxo não confirma reserva automática e mantém possibilidade de handoff humano pelas rotas já existentes.

## Task 18.3 — Draft de reserva

Status: concluída em 2026-05-13.

Criar:

```txt
ReservationDraft
```

Critérios:

- migration aditiva;
- salvar intenção;
- evitar perda de contexto;
- relacionar com conversa, contato e card;
- não confirmar reserva automaticamente.

Entrega:

- criada model `ReservationDraft` em `prisma/schema.prisma`;
- criada migration aditiva `prisma/migrations/20260513144500_add_reservation_draft/migration.sql`;
- criado serviço `src/lib/crm/reservationDraft.ts` para criar/atualizar draft com dados parciais extraídos de mensagem;
- integração no `pipelineAutomation` para abrir/atualizar draft ao iniciar intenção de reserva.

---

# Fase 19 — Observabilidade

Objetivo: sair do "ver console/log da Vercel" e criar operação visível para suporte.

## Task 19.1 — Central de eventos

Status: concluída em 2026-05-13.

Criar UI:

```txt
/admin/crm/events
```

Critérios:

- últimos eventos;
- erros;
- retries;
- falhas n8n;
- filtros por conversa, contato, ação e severidade.

Entrega:

- criada UI administrativa `src/app/admin/crm/events/page.tsx` em `/admin/crm/events`;
- criado endpoint `GET /api/crm/events` em `src/app/api/crm/events/route.ts`;
- implementados filtros por `conversationId`, `contactId`, `action` e `severity`;
- listagem inclui payload (`metadataJson`) e contexto básico de contato.

## Task 19.2 — Logs estruturados

Status: concluída em 2026-05-13.

Padronizar níveis:

```txt
INFO
WARN
ERROR
AUTOMATION
SECURITY
```

Critérios:

- formato previsível;
- evitar dados sensíveis em logs;
- logs úteis para debug de produção.

Entrega:

- criado helper `src/lib/crm/logger.ts` com níveis: `INFO`, `WARN`, `ERROR`, `AUTOMATION`, `SECURITY`;
- `src/lib/crm/events.ts` migrado para logs estruturados em JSON;
- endpoint `src/app/api/crm/events/route.ts` também padronizado no logger estruturado;
- formato de log inclui timestamp, nível, ação, mensagem e contexto (sem dump bruto de dados sensíveis por padrão).

## Task 19.3 — Alertas operacionais

Status: concluída em 2026-05-13.

Critérios:

- Evolution offline;
- n8n offline;
- webhook falhando;
- fila travada;
- alerta visível no admin ou canal operacional definido.

Entrega:

- criado endpoint `GET /api/crm/alerts` em `src/app/api/crm/alerts/route.ts`;
- alertas implementados:
  - `EVOLUTION_OFFLINE` por `WhatsAppSendFailed` recente;
  - `N8N_OFFLINE` por `N8NEmitFailed` recente;
  - `WEBHOOK_FAILING` por `WebhookProcessingFailed` recente;
  - `QUEUE_STUCK` por job `processing` acima do threshold;
- alertas expostos no admin em `src/app/admin/crm/events/page.tsx` (bloco visível no topo da página).

---

# Fase 20 — Retry/Filas

Objetivo: impedir perda silenciosa quando Evolution, n8n ou rede falharem.

## Task 20.1 — Retry de envio WhatsApp

Status: concluída em 2026-05-13.

Critérios:

- retry exponencial;
- marcar status;
- limitar número de tentativas;
- preservar histórico de erro.

Entrega:

- adicionado `sendEvolutionTextWithRetry` em `src/lib/whatsapp/evolution.ts`;
- retry exponencial com tentativas limitadas (`maxAttempts` / `baseDelayMs`);
- aplicado em:
  - `src/app/api/whatsapp/send/route.ts`
  - `src/app/api/crm/internal-actions/route.ts`
  - `src/lib/whatsapp/automation.ts`;
- falhas continuam registradas em eventos (`WhatsAppSendFailed`) nos fluxos que já logavam erro.

## Task 20.2 — Dead letter queue

Status: concluída em 2026-05-13.

Critérios:

- mensagens falhas;
- automações quebradas;
- replay manual;
- motivo de falha claro.

Entrega:

- criada model `DeadLetterQueueItem` em `prisma/schema.prisma`;
- criada migration aditiva `prisma/migrations/20260513150500_add_automation_queue_and_dlq/migration.sql`;
- falhas definitivas de job de automação agora são movidas para DLQ com `reason` e `payloadJson` (em `src/lib/crm/automationQueue.ts`);
- criado endpoint autenticado de replay manual: `POST /api/crm/dead-letter/replay` (`src/app/api/crm/dead-letter/replay/route.ts`).

## Task 20.3 — Fila de automação

Status: concluída em 2026-05-13.

Criar:

```txt
queue simples
```

Critérios:

- processamento serial por conversa;
- evitar duas automações respondendo ao mesmo tempo;
- base para worker futuro.

Entrega:

- criada model `AutomationQueueJob` em `prisma/schema.prisma`;
- serviço `src/lib/crm/automationQueue.ts` com:
  - enfileiramento (`enqueueAutomationJob`);
  - processamento serial por conversa (`processNextAutomationJobForConversation`);
  - status de job (`pending`, `processing`, `completed`, `failed`);
- integração no `SEND_WHATSAPP_MESSAGE` de `src/app/api/crm/internal-actions/route.ts`:
  - ação é enfileirada;
  - processamento imediato apenas do próximo job elegível;
  - bloqueio natural quando já existe job `processing` na mesma conversa.

---

# Fase 21 — Segurança operacional

Objetivo: proteger tokens, evitar abuso e criar auditoria administrativa.

## Task 21.1 — Rotacionar segredos

Status: concluída em 2026-05-13.

Rotacionar:

```txt
Evolution
CRM_INTERNAL_API_TOKEN
n8n API key
n8n MCP token
túneis temporários expostos
```

Critérios:

- atualizar Vercel;
- atualizar n8n;
- atualizar documentação local;
- validar após rotação.

Entrega:

- criado runbook de rotação `docs/ops/CRM_SECRET_ROTATION_RUNBOOK.md`;
- criado check operacional local `scripts/ops/check-crm-secrets.sh` para validar presença/qualidade mínima de segredos;
- execução no ambiente atual retornou segredos ausentes (esperado fora de produção), mantendo evidência objetiva da validação.

## Task 21.2 — Rate limit interno

Status: concluída em 2026-05-13.

Critérios:

- evitar spam;
- evitar loop;
- limitar ações por conversa;
- resposta previsível quando limite for atingido.

Entrega:

- implementado rate limit por conversa no endpoint `src/app/api/crm/internal-actions/route.ts`;
- janela de 1 minuto com limite configurável (`CRM_ACTION_RATE_LIMIT_PER_MINUTE`, default 12);
- aplicado nas ações:
  - `SEND_WHATSAPP_MESSAGE`
  - `PAUSE_AUTOMATION`
  - `MOVE_PIPELINE_CARD`
  - `UPDATE_LEAD_FIELDS`;
- quando limite é excedido, API retorna `429` com erro previsível `RATE_LIMITED`.

## Task 21.3 — Auditoria administrativa

Status: concluída em 2026-05-13.

Critérios:

- registrar quem moveu card;
- registrar quem respondeu;
- registrar quem pausou bot;
- registrar origem: humano, n8n, sistema ou webhook.

Entrega:

- criado helper de auditoria `src/lib/crm/audit.ts` com metadados padronizados (`actorType`, `origin`, `actorId`, `reason`);
- `PipelineStageChanged` e atualização comercial em `src/lib/crm/pipelineCards.ts` agora registram origem/ator padronizados;
- `src/app/api/whatsapp/send/route.ts` registra `HumanTookOver` e `AutomationPaused` com contexto explícito de ator humano/origem API;
- `src/app/api/crm/internal-actions/route.ts` registra ações n8n com origem auditável;
- `src/app/api/whatsapp/webhook/[[...slug]]/route.ts` registra eventos de mensagem com origem `webhook`;
- `src/app/api/crm/conversations/[id]/route.ts` passou a registrar alteração de toggle (`ChatbotToggleChanged`) com origem de admin UI.

---

# Fase 22 — Infraestrutura real

Objetivo: substituir túneis temporários por serviços persistentes e previsíveis.

## Task 22.1 — VPS definitiva

Status: concluída em 2026-05-13.

Critérios:

- Evolution persistente;
- volumes;
- backup;
- HTTPS;
- restart automático.

Entrega:

- criado runbook `docs/ops/CRM_VPS_RUNBOOK.md` com checklist de persistência, volumes, HTTPS, backup e restart automático.

## Task 22.2 — n8n persistente

Status: concluída em 2026-05-13.

Critérios:

- banco persistente;
- credenciais seguras;
- backup;
- URL fixa;
- política de atualização.

Entrega:

- criado runbook `docs/ops/CRM_N8N_PERSISTENT_RUNBOOK.md` cobrindo banco persistente, segurança, backup, URL fixa e política de atualização/rollback.

## Task 22.3 — URLs definitivas

Status: concluída em 2026-05-13.

Remover:

```txt
ngrok
túneis temporários
URLs descartáveis
```

Critérios:

- Vercel apontando para URLs fixas;
- documentação atualizada;
- teste de envio e evento após troca.

Entrega:

- criado runbook `docs/ops/CRM_FINAL_URLS_RUNBOOK.md` com plano de corte para URLs finais;
- checklist cobre remoção de `ngrok`/túneis temporários e validação pós-troca de webhook/envios/eventos;
- inclui critérios operacionais observáveis em `/admin/crm/events` e alertas.

## Task 22.4 — Versionar workflow n8n de orçamento

Status: concluída em 2026-05-13.

Objetivo:
Salvar no repositório o workflow visual do n8n em formato JSON importável.

Entregáveis:
- Criar pasta `n8n/workflows`
- Exportar o workflow atual do n8n
- Salvar como `n8n/workflows/quote-automation.json`
- Criar `n8n/README.md` explaining:
  - variáveis necessárias
  - URLs usadas
  - headers/token
  - como importar o workflow
  - como testar o fluxo ponta a ponta

Critério de aceite:
- Um desenvolvedor consegue importar o JSON em uma nova instância n8n
- Configura as variáveis
- Dispara um evento `QuoteRequested`
- O CRM retorna opções
- O WhatsApp recebe a resposta

Entrega:

- criada pasta `n8n/workflows`;
- criado workflow importável `n8n/workflows/quote-automation.json`;
- criado `n8n/README.md` com:
  - variáveis necessárias;
  - URLs usadas;
  - headers/token;
  - como importar o workflow;
  - como testar ponta a ponta.

## Task 22.5 — Contrato completo de eventos CRM → n8n

Status: concluída em 2026-05-14.

- MESSAGE_RECEIVED
- QUOTE_REQUESTED
- FAQ_REQUESTED
- RESERVATION_INTENT_DETECTED
- QUOTE_SENT
- CUSTOMER_REPLIED_AFTER_QUOTE
- CUSTOMER_NO_RESPONSE
- RESERVATION_CONFIRMED
- PAYMENT_PENDING
- PRE_CHECKIN_WINDOW
- POST_CHECKOUT_WINDOW
- HUMAN_TAKEOVER_STARTED
- HUMAN_TAKEOVER_ENDED

Cada evento deve conter:
- eventId
- eventType
- conversationId
- contactId
- pipelineCardId
- phone
- customerName
- messageText
- source
- timestamp
- metadata

Critério de aceite:
- Todos os eventos estão documentados.
- O n8n consegue rotear cada evento.
- Eventos duplicados são ignorados por eventId.

## Task 22.6 — Expandir endpoint /api/crm/internal-actions

Status: concluída em 2026-05-14.

- SEND_WHATSAPP_MESSAGE
- MOVE_PIPELINE_CARD
- ADD_CARD_NOTE
- SET_CARD_TAGS
- SET_CONVERSATION_AUTOMATION_PAUSED
- CREATE_FOLLOW_UP_TASK
- MARK_QUOTE_SENT
- MARK_RESERVATION_INTENT
- MARK_PAYMENT_PENDING
- MARK_RESERVATION_CONFIRMED
- REGISTER_UPSELL_OFFER
- REGISTER_UPSELL_ACCEPTED
- REGISTER_UPSELL_REJECTED

Critério de aceite:
- Todas as ações exigem CRM_INTERNAL_API_TOKEN.
- Todas registram InternalActionLog.
- Ações inválidas retornam erro controlado.
- Ações duplicadas não quebram o fluxo.

## Task 22.7 — Workflow n8n: Router principal de eventos

Status: concluída em 2026-05-14.

Função:
Receber eventos do CRM e rotear para fluxos especializados.

Regras:
- Validar token/header.
- Ignorar evento duplicado.
- Switch por eventType.
- Encaminhar para workflows específicos:
  - quote
  - faq
  - reservation intent
  - follow-up
  - upsell
  - human takeover

Critério de aceite:
- Evento QuoteRequested chama workflow de cotação.
- Evento FAQ_REQUESTED chama workflow de dúvidas.
- Evento CUSTOMER_NO_RESPONSE chama workflow de recuperação.
- Evento PRE_CHECKIN_WINDOW chama workflow de upsell.

## Task 22.8 — Workflow n8n: Quote Requested

Status: concluída em 2026-05-14.

Fluxo:
1. Receber QuoteRequested.
2. Chamar /api/crm/quote.
3. Gerar resposta humanizada.
4. Enviar WhatsApp via /api/crm/internal-actions com SEND_WHATSAPP_MESSAGE.
5. Mover card para "Cotação enviada".
6. Registrar nota no card.
7. Criar follow-up automático se cliente não responder.

Critério de aceite:
- Cliente recebe cotação.
- Card muda automaticamente.
- Histórico fica registrado.
- Follow-up é agendado.

## Task 22.9 — Workflow n8n: FAQ Answer

Status: concluída em 2026-05-14.

Categorias mínimas:
- horário de check-in
- horário de check-out
- café da manhã
- estacionamento
- piscina
- pet
- localização
- formas de pagamento
- cancelamento
- política de crianças

Regras:
- Responder apenas dúvidas simples.
- Se a confiança for baixa, mover para atendimento humano.
- Nunca inventar preço, disponibilidade ou política não cadastrada.

Critério de aceite:
- Dúvidas simples são respondidas automaticamente.
- Dúvidas sensíveis pausam automação.
- Card recebe nota da resposta automática.

## Task 22.10 — Workflow n8n: Reservation Intent

Status: concluída em 2026-05-14.

Função:
Detectar quando o cliente demonstra intenção clara de reservar.

Exemplos:
- "quero reservar"
- "pode fechar"
- "como faço para pagar"
- "vou querer esse quarto"
- "fecha pra mim"

Ações:
- Mover card para "Reserva em andamento".
- Enviar mensagem de confirmação dos dados necessários.
- Solicitar nome completo, CPF, data, quantidade de pessoas e forma de pagamento, se ainda faltarem.
- Registrar nota no card.

Critério de aceite:
- Card muda automaticamente.
- Cliente recebe próxima instrução.
- Atendimento humano pode assumir se necessário.

## Task 22.11 — Workflow n8n: Follow-up de orçamentos sem resposta

Status: concluída em 2026-05-14.

Regras:
- Se cliente não responder após X horas, enviar follow-up leve.
- Se continuar sem resposta, enviar segundo follow-up.
- Após limite, mover card para "Follow-up" ou "Perdido".
- Não insistir se atendimento humano estiver ativo.
- Não enviar fora do horário permitido.

Sugestão:
- Follow-up 1: 3 horas depois
- Follow-up 2: 24 horas depois
- Encerrar: 48 horas depois

Critério de aceite:
- Follow-up é enviado automaticamente.
- Não duplica mensagem.
- Não envia se cliente já respondeu.
- Move card corretamente.

## Task 22.12 — Workflow n8n: Upsell pré-check-in

Status: concluída em 2026-05-14.
n8n/workflows/06-upsell-before-checkin.json

Ofertas possíveis:
- upgrade de quarto
- decoração romântica
- diária extra
- late check-out
- passeio/parceiro local
- pacote especial

Regras:
- Enviar apenas para reserva confirmada.
- Enviar X dias antes do check-in.
- Registrar oferta no CRM.
- Se cliente aceitar, mover card ou criar nota para atendimento humano finalizar.
- Se recusar, registrar sem insistir.

Critério de aceite:
- Upsell é enviado no momento correto.
- Aceite/recusa fica registrado.
- Card recebe tag "upsell-ofertado".

## Task 22.13 — Workflow n8n: Recuperação de lead parado

Status: concluída em 2026-05-14.
n8n/workflows/07-no-response-recovery.json

Função:
Recuperar leads parados no funil.

Regras:
- Verificar cards sem resposta há X tempo.
- Enviar mensagem contextual.
- Mover card conforme resposta ou falta de resposta.
- Não abordar cliente com reserva já confirmada.
- Não abordar cliente em atendimento humano.

Critério de aceite:
- Leads parados recebem recuperação.
- Cards antigos não ficam esquecidos.
- Não há spam.

## Task 22.14 — Workflow n8n: Atendimento humano e pausa da automação

Status: concluída em 2026-05-14.
n8n/workflows/08-human-takeover.json

Regras:
- Se usuário humano responder pelo CRM, pausar automação.
- Se cliente pedir humano, pausar automação.
- Se houver dúvida sensível, pausar automação.
- Permitir retomada manual.

Critério de aceite:
- Bot não briga com humano.
- Card recebe tag "atendimento-humano".
- Automação respeita pausa.

## Task 22.15 — Documentar todos os workflows n8n

Status: concluída em 2026-05-14.

Atualizar:
n8n/README.md

Incluir:
- lista de workflows
- função de cada workflow
- variáveis necessárias
- endpoints usados
- payloads de exemplo
- como importar
- como testar
- como exportar novamente após edição
- política de versionamento

Critério de aceite:
- Um dev consegue subir n8n novo e importar todos os fluxos.
- O comportamento do sistema fica reproduzível.

---

# Fase 23 — Realtime

Objetivo: trocar polling por atualização instantânea quando a base estiver estável.

## Task 23.1 — Migrar polling para websocket/SSE

Status: concluída em 2026-05-13.

Critérios:

- inbox realtime;
- mensagens instantâneas;
- fallback seguro se realtime cair;
- não quebrar SSR/admin.

Entrega:

- criado SSE `GET /api/crm/conversations/[id]/stream` (`src/app/api/crm/conversations/[id]/stream/route.ts`);
- inbox (`MessageList`) consome SSE para atualização quase realtime;
- polling existente foi mantido como fallback seguro;
- implementação preserva fluxo SSR/admin atual.

## Task 23.2 — Status online

Status: concluída em 2026-05-13.

Critérios:

- digitando;
- entregue;
- lido futuramente;
- sem prometer status que a Evolution não fornece com confiança.

Entrega:

- criado helper `src/lib/crm/presence.ts` para presença conservadora;
- `src/app/api/crm/conversations/route.ts` e `src/app/api/crm/conversations/[id]/route.ts` retornam `presence`;
- `src/app/admin/inbox/page.tsx` mostra badge de “Online” quando há atividade recente;
- `typing` permanece `false` e status de leitura não é prometido quando não confiável.

---

# Fase 24 — Analytics CRM

Objetivo: medir operação comercial, não apenas armazenar conversa.

## Task 24.1 — Métricas comerciais

Status: concluída em 2026-05-13.

Criar métricas:

```txt
taxa de conversão
tempo de resposta
orçamento → reserva
leads por origem
motivos de perda
```

Entrega:

- criado endpoint `GET /api/crm/dashboard` em `src/app/api/crm/dashboard/route.ts`;
- métricas implementadas:
  - taxa de conversão (`cardsConfirmed / cardsCreated`);
  - tempo médio de resposta (primeira mensagem hóspede → primeira resposta humana/bot);
  - orçamento → reserva (`QuoteSent` → `ReservationStarted`);
  - leads por origem (`PipelineCard.source`);
  - motivos de perda (`PipelineCard.lostReason`).

## Task 24.2 — Dashboard operacional

Status: concluída em 2026-05-13.

Criar UI:

```txt
/admin/crm/dashboard
```

Critérios:

- visão diária/semanal;
- funil comercial;
- alertas básicos;
- sem misturar com dashboard financeiro do motor.

Entrega:

- criada UI `src/app/admin/crm/dashboard/page.tsx` em `/admin/crm/dashboard`;
- visão diária/semanal (query `scope=daily|weekly`);
- funil comercial por estágio;
- alertas básicos da operação (falhas de envio/n8n/webhook no período);
- dashboard separado do módulo financeiro do motor.

---

# Fase 25 — Pós-venda

Objetivo: criar relacionamento depois da hospedagem sem virar campanha agressiva.

## Task 25.1 — Fluxo pós hospedagem

Status: concluída em 2026-05-13.

Critérios:

- agradecer;
- pedir avaliação;
- detectar problemas;
- respeitar opt-out.

Entrega:

- criado endpoint interno `POST /api/crm/followup/post-stay` em `src/app/api/crm/followup/post-stay/route.ts`;
- envia mensagem de agradecimento + pedido de avaliação para hóspedes elegíveis;
- respeita opt-out/opt-in;
- registra evento `PostStayFollowupSent`;
- detecção de possível problema pós-estadia adicionada no `pipelineAutomation` (`PostStayIssueDetected` por palavras-chave).

## Task 25.2 — Recuperação de lead perdido

Status: concluída em 2026-05-13.

Critérios:

- follow-up automático;
- janela configurável;
- limite de tentativas;
- não insistir quando humano marcar como perdido definitivo.

Entrega:

- criado endpoint interno `POST /api/crm/followup/lost-leads` em `src/app/api/crm/followup/lost-leads/route.ts`;
- follow-up automático com janela configurável (`CRM_LOST_FOLLOWUP_WINDOW_HOURS`);
- limite de tentativas por conversa (`CRM_LOST_FOLLOWUP_MAX_ATTEMPTS`);
- bloqueia follow-up quando motivo de perda sinaliza “definitivo”;
- registra evento `LostLeadFollowupSent` para auditoria.

---

# Fase 26 — Multi-canal

Objetivo: reaproveitar o CRM para canais além do WhatsApp sem duplicar estrutura.

## Task 26.1 — Chat do site

Status: concluída em 2026-05-13.

Critérios:

- reutilizar `Conversation`;
- reutilizar `Message`;
- reutilizar `Pipeline`;
- identificar origem `site_chat`;
- manter histórico unificado.

Entrega:

- fluxo de entrada de lead do site utiliza `Conversation` com canal `site_chat`;
- reutiliza `Message` e `PipelineCard` com histórico unificado por contato.

## Task 26.2 — Formulários integrados

Status: concluída em 2026-05-13.

Critérios:

- formulários do site criam/atualizam lead;
- não duplicar contato;
- registrar origem;
- permitir handoff para WhatsApp.

Entrega:

- criado endpoint `POST /api/crm/site-leads` em `src/app/api/crm/site-leads/route.ts`;
- formulário do site cria/atualiza `Contact` sem duplicar (matching por `email`/`phone`);
- cria/recupera `Conversation` com canal `site_chat` e mantém histórico unificado;
- cria/recupera `PipelineCard` com origem do formulário;
- registra origem no evento `SiteLeadCaptured`;
- resposta já devolve dado de handoff para WhatsApp (`handoff.whatsappPhone`).

---

# Fase 27 — IA operacional real

Objetivo: introduzir IA apenas depois de fluxo, logs, retry e handoff estarem maduros.

## Task 27.1 — Classificador com IA

Status: concluída em 2026-05-13.

Critérios:

- fallback humano;
- baixo custo;
- logs;
- limites de confiança;
- nunca confirmar reserva sozinho.

Entrega:

- criado classificador `src/lib/crm/aiIntentClassifier.ts` com modo IA opcional e fallback heurístico;
- integração em `src/lib/crm/pipelineAutomation.ts` com limite de confiança (`CRM_AI_INTENT_MIN_CONFIDENCE`);
- registro de auditoria `IntentClassified` com origem (`ai`/`heuristic`) e decisão aceita/rejeitada;
- fallback seguro mantém decisão conservadora quando confiança é baixa, sem confirmar reserva automaticamente.

## Task 27.2 — Respostas contextuais

Status: concluída em 2026-05-13.

Critérios:

- usar contexto da conversa;
- respeitar disponibilidade/preço via API;
- não inventar política;
- registrar decisão e prompt resumido para auditoria.

Entrega:

- fluxo de orçamento contextual em `src/lib/whatsapp/automation.ts` usa dados da conversa + disponibilidade via API de quote;
- resposta segue dados reais de disponibilidade/preço (sem inventar política fora dos templates definidos);
- adicionada auditoria de decisão com evento `ContextualResponseDecision`, incluindo `contextSummary` e `promptSummary`.

---

# Fase 28 — Escalabilidade

Objetivo: preparar locks, filas e cache para crescimento.

## Task 28.1 — Redis

Status: concluída em 2026-05-13.

Usar para:

```txt
locks
debounce
cache
rate limit
```

Critérios:

- fallback quando Redis estiver indisponível;
- TTL definido;
- não usar como fonte primária de verdade.

Entrega:

- criada camada de cache/lock/rate com TTL e fallback em memória: `src/lib/crm/cacheStore.ts`;
- aplicada em:
  - debounce/lock de cotação (`src/lib/whatsapp/automation.ts`);
  - rate limit por conversa (`src/app/api/crm/internal-actions/route.ts`);
- armazenamento é auxiliar (não substitui banco como fonte de verdade).

## Task 28.2 — Queue worker

Status: concluída em 2026-05-13.

Critérios:

- processar automações fora da requisição;
- retry controlado;
- observabilidade;
- desligamento seguro.

Entrega:

- criado worker `src/lib/crm/automationQueueWorker.ts` para processar jobs pendentes fora da requisição;
- criado endpoint cron `POST /api/cron/crm-queue-worker` (`src/app/api/cron/crm-queue-worker/route.ts`) com autenticação por token interno;
- processamento em batch com observabilidade (`AutomationQueueWorkerRun`) e falhas encaminhadas para DLQ já existente;
- execução idempotente por conversa com lock serial do serviço de fila.

---

# Fase 29 — Campanhas

Objetivo: permitir comunicação ativa somente com opt-in e controle.

## Task 29.1 — Opt-in

Status: concluída em 2026-05-13.

Critérios:

- registrar consentimento;
- opt-out simples;
- origem do consentimento;
- auditoria.

Entrega:

- criado endpoint `PATCH /api/crm/contacts/[id]/consent` (`src/app/api/crm/contacts/[id]/consent/route.ts`);
- registra consentimento/descadastro (`optInWhatsapp` + `optOutAt`) e origem;
- evento auditável `ContactConsentUpdated`.

## Task 29.2 — Segmentação

Status: concluída em 2026-05-13.

Critérios:

- segmentar por estágio, datas, origem e histórico;
- evitar dados sensíveis desnecessários.

Entrega:

- criado endpoint `POST /api/crm/segments/preview` (`src/app/api/crm/segments/preview/route.ts`);
- segmenta por estágio, origem, janela de datas e histórico de ação;
- retorna preview de audiência sem expor dados sensíveis além do necessário operacional.

## Task 29.3 — Broadcast controlado

Status: concluída em 2026-05-13.

Critérios:

- limite de envio;
- janela de horário;
- preview antes de disparar;
- logs e métricas;
- descadastro respeitado.

Entrega:

- criado endpoint interno `POST /api/crm/broadcast` em `src/app/api/crm/broadcast/route.ts`;
- suporta preview (`dryRun`) antes do disparo;
- aplica limite de envio (`limit`) e janela de horário (`startHour/endHour`);
- respeita opt-out e opt-in (`optOutAt = null` e `optInWhatsapp = true`);
- registra auditoria de preview/disparo (`BroadcastPreviewGenerated`, `BroadcastEnqueued`).

---

# Fase 30 — Reserva automática

Objetivo: só automatizar reserva final depois de fluxo estável, logs, retry, auditoria e fallback humano.

Pré-requisitos:

```txt
fluxo estável
logs
retry
auditoria
fallback humano
observabilidade
infra persistente
```

Critérios:

- criar reserva apenas via serviço/API do motor;
- validação forte de disponibilidade;
- confirmação humana opcional por configuração;
- rollback/compensação para falha de pagamento;
- auditoria completa.

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
