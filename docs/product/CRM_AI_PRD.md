# PRD/SPEC — CRM de atendimento e reservas com IA

**Produto:** Delplata CRM
**Status:** proposta para validação
**Atualizado em:** 2026-07-22

## 1. Visão

Transformar o CRM existente em uma operação confiável de atendimento via WhatsApp Cloud API oficial da Meta, com IA supervisionada, atualização automática do Kanban, follow-ups e pós-venda com pedido de avaliação e cupom individual de 10% para nova reserva direta.

O projeto não parte do zero. Já existem banco, Inbox, integração legada com WhatsApp/Evolution, pipeline, eventos, fila, regras de chatbot, classificação de intenção, orçamento, rascunho de reserva, consentimento e endpoints de follow-up. A prioridade é estabilizar e integrar essas partes, migrando o transporte para a API oficial da Meta sem outro ciclo de apagar e reconstruir.

O plano executável, dividido em fases, regras de negócio, testes e microtarefas, está em [CRM_AI_PHASES_TODO.md](./CRM_AI_PHASES_TODO.md).

## 2. Diagnóstico do repositório em 2026-07-22

### O que pode ser reaproveitado

- modelos Prisma para contato, conversa, mensagens, pipeline, histórico, fila, dead-letter, regras do bot e reserva assistida;
- webhook WhatsApp com identidade JID/LID e deduplicação;
- Inbox, resposta manual, pausa e controle do chatbot;
- API e máquina de estados do pipeline;
- consulta de orçamento e rascunho de reserva;
- retry, fila, dead-letter, auditoria e eventos;
- consentimento, segmentação e broadcast controlado;
- classificador IA com fallback heurístico;
- motor de cupons com template privado de 10% e antifraude;
- endpoints iniciais de lead perdido e pós-estadia.

### O que está parcial ou inconsistente

- o commit `d9cd8a3` resetou o n8n; seu README diz que os workflows foram removidos, mas o SDD anterior marca todos como concluídos;
- o único workflow versionado é um roteador inativo e sem ações finais;
- pós-estadia seleciona cards em `HOSPEDADO`, sem comprovar checkout e sem emitir cupom;
- follow-up não é uma agenda cancelável por resposta ou reserva;
- IA cobre poucas intenções, sem schema estrito, versionamento de prompt ou telemetria completa;
- `PipelineCard` tem `lossReason` e `lostReason`, além de default `novo` incompatível com `NOVO_LEAD`;
- `bookingId` é texto no card, sem relacionamento oficial com `Booking`;
- documentação e runtime divergem sobre a emissão para n8n;
- typecheck + testes agregados excederam 120 segundos sem resultado, portanto o baseline ainda não está comprovado;
- existem `.env`, backups, zip e artefatos no diretório: auditar o que está versionado e rotacionar segredos eventualmente expostos.

**Conclusão:** não recomeçar. A base é valiosa; falta uma automação ponta a ponta comprovada e uma única fonte de verdade documental.

## 3. Objetivos e métricas

### MVP

1. Centralizar mensagens do WhatsApp na Inbox.
2. Responder FAQ e coletar dados para orçamento.
3. Atualizar o Kanban por eventos auditáveis.
4. Transferir casos sensíveis ou incertos para humano.
5. Executar follow-ups sem duplicidade ou spam.
6. Após checkout, solicitar avaliação e entregar cupom individual de 10%.

### Indicadores

- tempo da primeira resposta e percentual automatizado;
- transferências e respostas corrigidas por atendente;
- orçamentos, reservas e conversão por etapa;
- follow-ups enviados, respondidos e convertidos;
- avaliações solicitadas e cliques;
- cupons emitidos, resgatados e receita atribuída;
- falhas, retries e itens na dead-letter queue.

Meta inicial recomendada: automatizar com segurança 50–70% das mensagens elegíveis, não 100%.

## 4. Escopo

### Incluído

- WhatsApp via WhatsApp Cloud API oficial da Meta;
- Inbox e handoff humano;
- IA para intenção, extração de dados e composição de respostas;
- FAQ baseada em conteúdo aprovado;
- disponibilidade e preço consultados no motor existente;
- link para concluir reserva no site;
- Kanban automático e manual com auditoria;
- follow-ups de orçamento e lead parado;
- eventos de reserva, pagamento, check-in e checkout;
- pós-venda, avaliação e cupom de retorno;
- opt-in/out, quiet hours, idempotência e métricas.

### Não incluído no MVP

- IA confirmando reserva, pagamento, cancelamento ou reembolso;
- IA inventando disponibilidade, tarifa ou desconto;
- n8n escrevendo diretamente no banco;
- disparo em massa sem consentimento;
- novos canais antes de estabilizar o WhatsApp.

## 5. Jornadas

### 5.1 Mensagem e qualificação

1. A WhatsApp Cloud API da Meta chama o webhook verificado.
2. CRM valida, deduplica e resolve JID/LID/telefone.
3. Cria/atualiza contato, conversa, mensagem e card `NOVO_LEAD`.
4. Gera `MessageReceived` e agenda processamento fora do webhook.
5. IA devolve intenção, entidades, confiança e risco em JSON validado.
6. Regras decidem: responder, pedir dado ou transferir.
7. Toda resposta e mudança de estágio é persistida e auditada.

### 5.2 Orçamento e reserva

Dados mínimos: check-in, checkout, adultos, crianças e idades quando aplicável.

```text
NOVO_LEAD → QUALIFICANDO → CONSULTANDO_DISPONIBILIDADE
→ ORCAMENTO_ENVIADO → AGUARDANDO_RESPOSTA
→ RESERVA_EM_ANDAMENTO → PAGAMENTO_PENDENTE
→ RESERVA_CONFIRMADA → HOSPEDADO → POS_VENDA
```

Preço, disponibilidade, inventário, restrições e capacidade vêm obrigatoriamente do mesmo domínio usado pelo **Mapa de Tarifas do motor de reservas**. O CRM não possui cálculo comercial paralelo. O orçamento possui validade e link rastreável. Reserva e pagamento só mudam de estado após evento confiável do sistema responsável.

### 5.3 Atendimento humano

Transferir em baixa confiança, reclamação, cancelamento, reembolso, emergência, negociação fora das regras, pedido explícito ou falha repetida. Resposta humana define `automationPausedUntil`, cancela ações conflitantes e registra `HumanTookOver`. Retorno ao bot deve ser explícito.

### 5.4 Follow-ups

Cadência inicial configurável: 2h, 24h e 72h após orçamento sem resposta. Antes de enviar, validar consentimento, opt-out, resposta posterior, reserva criada, pausa humana, horário permitido, tentativas, dedupe e validade da oferta.

Cada job deve ter `scheduledAt`, `status`, `attempts`, `dedupeKey`, `cancelReason` e `journeyType`. Resposta do cliente ou reserva confirmada cancela os jobs incompatíveis.

### 5.5 Pós-estadia, avaliação e 10%

Gatilho: checkout confirmado no `Booking`, nunca somente tempo parado em `HOSPEDADO`.

1. Checkout → card `POS_VENDA`.
2. Após 3h, agradecer e perguntar se ocorreu tudo bem.
3. Se houver problema/sentimento negativo, transferir e pausar pedido público de avaliação.
4. Caso positivo, após 24h enviar link oficial de avaliação.
5. Emitir cupom de 10%, individual, uso único, vinculado a telefone/e-mail, válido inicialmente por 90 dias, não cumulativo e apenas para reserva direta.
6. Enviar código e link do site com cupom pré-aplicado.
7. Registrar `ReviewRequested`, `CouponIssued`, `CouponSent` e `CouponRedeemed`.

O desconto é benefício de retorno e não pode ser condicionado a uma avaliação positiva. Texto e ordem devem respeitar a política da plataforma de avaliação escolhida.

## 6. Política da IA

### Pode

- classificar intenção/sentimento e extrair dados;
- responder conteúdo aprovado;
- redigir usando dados retornados por ferramentas;
- resumir conversa e sugerir próximo estágio.

### Não pode

- criar preço, disponibilidade, desconto ou cortesia;
- confirmar eventos sem fonte oficial;
- ignorar pausa, opt-out ou limites;
- chamar endpoints fora de uma allowlist com schemas estritos.

Exemplo de decisão:

```json
{
  "intent": "quote",
  "confidence": 0.91,
  "entities": {"checkin":"2026-08-10","checkout":"2026-08-12","adults":2,"children":0},
  "risk": "low",
  "nextAction": "request_quote"
}
```

Resposta automática apenas acima do limiar e com `risk=low`.

## 7. Arquitetura

```text
WhatsApp Cloud API (Meta) → webhook idempotente → CRM/Banco → fila de eventos
→ worker/n8n → IA + APIs internas → policy engine
→ outbox → WhatsApp Cloud API (Meta)

Motor de reservas/pagamento → eventos de Booking
→ CRM → Kanban + agenda/cancelamento de automações
```

- CRM é a fonte oficial de atendimento e funil.
- O domínio do Mapa do motor é a fonte oficial de tarifas, inventário, restrições, disponibilidade e capacidade; Booking/pagamento é a fonte oficial de reserva e estadia.
- IA interpreta e redige; não é sistema de registro.
- n8n/worker orquestra e não acessa o banco diretamente.

Não é permitido copiar a lógica de tarifa/disponibilidade para `src/lib/crm`. O Mapa e o CRM devem chamar um único serviço de domínio extraído do motor. A tela `/admin/mapa` é uma interface de edição/consulta desse domínio, e não uma segunda API a ser raspada pelo CRM.

## 8. Dados e contratos a ajustar

- criar `Conversation.botMode`: `off | supervised | auto`;
- ligar oficialmente `Booking`, `Contact` e `PipelineCard`;
- adicionar à fila `scheduledAt`, `dedupeKey`, `cancelledAt`, `cancelReason`, `journeyType`;
- criar registro `AiDecision` com modelo/prompt versionados, confiança, decisão, tools, latência e tokens;
- criar outbox de mensagens com status, tentativa, externalId e erro;
- criar `CouponGrant` ou vínculo do cupom com contato, estadia, envio e resgate;
- versionar quiet hours, cadências, limiar da IA, URL de avaliação e regras do cupom;
- unificar `lossReason`/`lostReason` e o estágio default;
- trocar contratos `any` por payloads validados em runtime.

Eventos mínimos: `MessageReceived`, `LeadCreated`, `IntentClassified`, `QuoteRequested`, `QuoteSent`, `CustomerReplied`, `HumanTookOver`, `BookingConfirmed`, `CheckoutConfirmed`, `FollowupScheduled`, `FollowupCancelled`, `FollowupSent`, `ReviewRequested`, `CouponIssued`, `CouponSent`, `CouponRedeemed`, `AutomationFailed`.

Todo evento terá `eventId`, `eventType`, `occurredAt`, `entityId`, `correlationId`, `causationId`, `schemaVersion` e payload validado.

## 9. Segurança e operação

- validar assinatura dos webhooks e autenticar APIs internas;
- rate limit por contato, rota e integração;
- mascarar PII e enviar ao modelo apenas dados necessários;
- consentimento, origem e opt-out por palavras como `SAIR`/`PARAR`;
- acesso por papel e auditoria administrativa;
- kill switch global e por conversa;
- replay seguro da dead-letter queue;
- retenção e exclusão conforme LGPD;
- nunca registrar tokens ou payloads sensíveis completos.

## 10. Critérios de aceite

1. Webhook duplicado gera uma Message e uma ação.
2. Novo lead aparece na Inbox e Kanban em até 5s.
3. FAQ segura responde; desconhecida transfere.
4. Orçamento usa disponibilidade/preço reais.
5. Resposta humana pausa e cancela automações conflitantes.
6. Resposta do cliente cancela follow-up pendente.
7. Reserva confirmada move o card e encerra follow-up comercial.
8. Checkout cria exatamente uma jornada de pós-venda.
9. Reclamação abre atendimento e interrompe avaliação pública.
10. Cupom de 10% é individual, único, não cumulativo, expira e funciona no site.
11. Falha temporária usa backoff; final vai à dead-letter e alerta.
12. Dashboard não duplica métricas.

## 11. Plano de execução

### Fase 0 — Baseline (1–2 dias)

- criar tag/backup; não apagar módulos;
- inventariar ambiente, URLs, migrations e dados;
- executar suítes separadas e registrar baseline;
- decidir n8n versus worker do app como orquestrador principal.

### Fase 1 — Fundação (3–5 dias)

- normalizar schema e vínculo com Booking;
- agenda, cancelamento e dedupe;
- outbox e health check;
- alinhar documentação ao runtime.

### Fase 1B — Migração para Meta (3–6 dias)

- criar adaptador de canal e implementação da WhatsApp Cloud API;
- verificar webhook e assinatura, normalizar mensagens e status;
- executar testes de contrato e homologação com número de teste;
- fazer canário, rollback e só então retirar Evolution do caminho principal.

### Fase 2 — IA supervisionada (4–7 dias)

- saída estruturada, policy engine, FAQ e orçamento;
- handoff/retomada e testes com conversas anonimizadas;
- iniciar em modo sugestão e liberar apenas intents seguras.

### Fase 3 — Kanban e follow-up (3–5 dias)

- eventos do funil, cadência, cancelamento, quiet hours, opt-out e métricas.

### Fase 4 — Pós-venda (3–5 dias)

- checkout, satisfação, avaliação, cupom 10%, link pré-aplicado e atribuição.

### Fase 5 — Piloto (7–14 dias)

- shadow mode, revisão diária, rollout gradual, runbook e rollback por kill switch.

## 12. Decisões do proprietário

Antes da Fase 2, confirmar:

1. plataforma/link oficial de avaliação;
2. validade, teto e valor mínimo do cupom;
3. horários automáticos;
4. cadência de follow-up;
5. políticas/FAQs oficiais;
6. n8n ou worker próprio;
7. usuários e perfis de acesso.
