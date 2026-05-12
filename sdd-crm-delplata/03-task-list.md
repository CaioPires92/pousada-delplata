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

# Fase 16 — Automação de orçamento via n8n

Objetivo: transformar o orçamento em fluxo operacional real, sem colocar regra de negócio dentro do n8n e sem acesso direto ao banco.

## Task 16.1 — Criar parser básico de intenção

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

## Task 16.2 — Criar estado conversacional

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

## Task 16.3 — Fluxo automático de coleta

Critérios:

- perguntar apenas dados faltantes;
- evitar loops;
- respeitar pausa humana;
- respeitar `chatbotEnabled`;
- timeout de fluxo;
- registrar eventos relevantes.

## Task 16.4 — Automação de orçamento ponta a ponta

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

## Task 16.5 — Debounce de orçamento

Critérios:

- impedir múltiplas cotações simultâneas;
- lock temporal por conversa;
- evitar spam;
- registrar quando uma cotação for ignorada por debounce;
- manter comportamento seguro se n8n atrasar ou repetir execução.

---

# Fase 17 — Pipeline orientado a estado

Objetivo: impedir que o Kanban vire uma coleção de estados soltos sem regra operacional.

## Task 17.1 — Criar state machine do pipeline

Criar:

```txt
src/lib/crm/pipelineMachine.ts
```

Critérios:

- validar transições;
- impedir estados inválidos;
- retornar erro claro;
- cobrir transições por testes.

Exemplo:

```txt
NOVO_LEAD → PAGAMENTO_PENDENTE não deve ser permitido diretamente.
```

## Task 17.2 — Automatizar mudanças de estágio

Critérios:

- `QuoteSent` → `ORCAMENTO_ENVIADO`;
- cliente respondeu após orçamento → `AGUARDANDO_RESPOSTA`;
- reserva iniciada → `RESERVA_EM_ANDAMENTO`;
- automação deve usar API/serviço do CRM;
- humano pode sobrescrever quando necessário.

## Task 17.3 — Histórico completo de movimentação

Criar tabela:

```txt
PipelineStageHistory
```

Critérios:

- migration aditiva;
- auditoria completa;
- base para analytics futuro;
- registrar estágio anterior, estágio novo, ator, motivo e timestamp.

---

# Fase 18 — Reserva assistida

Objetivo: permitir avanço comercial até intenção clara de reserva, ainda sem automatizar a reserva final.

## Task 18.1 — Detectar intenção de reserva

Critérios:

- identificar mensagens como:
  - `quero fechar`;
  - `como faço pagamento`;
  - `vamos reservar`;
- emitir `ReservationStarted`;
- evitar falso positivo agressivo.

## Task 18.2 — Fluxo assistido de reserva

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

## Task 18.3 — Draft de reserva

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

---

# Fase 19 — Observabilidade

Objetivo: sair do "ver console/log da Vercel" e criar operação visível para suporte.

## Task 19.1 — Central de eventos

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

## Task 19.2 — Logs estruturados

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

## Task 19.3 — Alertas operacionais

Critérios:

- Evolution offline;
- n8n offline;
- webhook falhando;
- fila travada;
- alerta visível no admin ou canal operacional definido.

---

# Fase 20 — Retry/Filas

Objetivo: impedir perda silenciosa quando Evolution, n8n ou rede falharem.

## Task 20.1 — Retry de envio WhatsApp

Critérios:

- retry exponencial;
- marcar status;
- limitar número de tentativas;
- preservar histórico de erro.

## Task 20.2 — Dead letter queue

Critérios:

- mensagens falhas;
- automações quebradas;
- replay manual;
- motivo de falha claro.

## Task 20.3 — Fila de automação

Criar:

```txt
queue simples
```

Critérios:

- processamento serial por conversa;
- evitar duas automações respondendo ao mesmo tempo;
- base para worker futuro.

---

# Fase 21 — Segurança operacional

Objetivo: proteger tokens, evitar abuso e criar auditoria administrativa.

## Task 21.1 — Rotacionar segredos

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

## Task 21.2 — Rate limit interno

Critérios:

- evitar spam;
- evitar loop;
- limitar ações por conversa;
- resposta previsível quando limite for atingido.

## Task 21.3 — Auditoria administrativa

Critérios:

- registrar quem moveu card;
- registrar quem respondeu;
- registrar quem pausou bot;
- registrar origem: humano, n8n, sistema ou webhook.

---

# Fase 22 — Infraestrutura real

Objetivo: substituir túneis temporários por serviços persistentes e previsíveis.

## Task 22.1 — VPS definitiva

Critérios:

- Evolution persistente;
- volumes;
- backup;
- HTTPS;
- restart automático.

## Task 22.2 — n8n persistente

Critérios:

- banco persistente;
- credenciais seguras;
- backup;
- URL fixa;
- política de atualização.

## Task 22.3 — URLs definitivas

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

---

# Fase 23 — Realtime

Objetivo: trocar polling por atualização instantânea quando a base estiver estável.

## Task 23.1 — Migrar polling para websocket/SSE

Critérios:

- inbox realtime;
- mensagens instantâneas;
- fallback seguro se realtime cair;
- não quebrar SSR/admin.

## Task 23.2 — Status online

Critérios:

- digitando;
- entregue;
- lido futuramente;
- sem prometer status que a Evolution não fornece com confiança.

---

# Fase 24 — Analytics CRM

Objetivo: medir operação comercial, não apenas armazenar conversa.

## Task 24.1 — Métricas comerciais

Criar métricas:

```txt
taxa de conversão
tempo de resposta
orçamento → reserva
leads por origem
motivos de perda
```

## Task 24.2 — Dashboard operacional

Criar UI:

```txt
/admin/crm/dashboard
```

Critérios:

- visão diária/semanal;
- funil comercial;
- alertas básicos;
- sem misturar com dashboard financeiro do motor.

---

# Fase 25 — Pós-venda

Objetivo: criar relacionamento depois da hospedagem sem virar campanha agressiva.

## Task 25.1 — Fluxo pós hospedagem

Critérios:

- agradecer;
- pedir avaliação;
- detectar problemas;
- respeitar opt-out.

## Task 25.2 — Recuperação de lead perdido

Critérios:

- follow-up automático;
- janela configurável;
- limite de tentativas;
- não insistir quando humano marcar como perdido definitivo.

---

# Fase 26 — Multi-canal

Objetivo: reaproveitar o CRM para canais além do WhatsApp sem duplicar estrutura.

## Task 26.1 — Chat do site

Critérios:

- reutilizar `Conversation`;
- reutilizar `Message`;
- reutilizar `Pipeline`;
- identificar origem `site_chat`;
- manter histórico unificado.

## Task 26.2 — Formulários integrados

Critérios:

- formulários do site criam/atualizam lead;
- não duplicar contato;
- registrar origem;
- permitir handoff para WhatsApp.

---

# Fase 27 — IA operacional real

Objetivo: introduzir IA apenas depois de fluxo, logs, retry e handoff estarem maduros.

## Task 27.1 — Classificador com IA

Critérios:

- fallback humano;
- baixo custo;
- logs;
- limites de confiança;
- nunca confirmar reserva sozinho.

## Task 27.2 — Respostas contextuais

Critérios:

- usar contexto da conversa;
- respeitar disponibilidade/preço via API;
- não inventar política;
- registrar decisão e prompt resumido para auditoria.

---

# Fase 28 — Escalabilidade

Objetivo: preparar locks, filas e cache para crescimento.

## Task 28.1 — Redis

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

## Task 28.2 — Queue worker

Critérios:

- processar automações fora da requisição;
- retry controlado;
- observabilidade;
- desligamento seguro.

---

# Fase 29 — Campanhas

Objetivo: permitir comunicação ativa somente com opt-in e controle.

## Task 29.1 — Opt-in

Critérios:

- registrar consentimento;
- opt-out simples;
- origem do consentimento;
- auditoria.

## Task 29.2 — Segmentação

Critérios:

- segmentar por estágio, datas, origem e histórico;
- evitar dados sensíveis desnecessários.

## Task 29.3 — Broadcast controlado

Critérios:

- limite de envio;
- janela de horário;
- preview antes de disparar;
- logs e métricas;
- descadastro respeitado.

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
