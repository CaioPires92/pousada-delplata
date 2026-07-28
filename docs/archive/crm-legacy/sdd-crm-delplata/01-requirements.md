# Requirements — CRM WhatsApp Delplata

## 1. Objetivo

Criar um módulo de CRM dentro do projeto `Delplata-Motor` para centralizar conversas, contatos, pipeline comercial e automações futuras via WhatsApp e chat do site.

O CRM deve substituir gradualmente o uso operacional do WhatsApp Web pela recepção, sem quebrar o motor de reservas existente.

## 2. Escopo principal

O CRM deve permitir:

- receber mensagens da Evolution API via webhook;
- identificar ou criar contatos;
- criar e manter conversas por canal;
- salvar mensagens recebidas e enviadas;
- listar conversas em uma inbox interna;
- exibir histórico de conversa;
- responder manualmente pelo CRM;
- criar e atualizar cards no Kanban;
- pausar automação quando humano assumir;
- registrar logs internos de ações importantes;
- preparar base para n8n conduzir fluxos de reserva futuramente;
- preparar base para chat do site usar a mesma lógica do WhatsApp.

## 3. O que o CRM não deve fazer agora

Nesta fase, o CRM não deve:

- substituir o motor de reservas;
- criar reserva definitiva sem validação do fluxo de reserva;
- consultar Hospedin em tempo real como fonte principal;
- permitir que o n8n escreva direto no banco;
- implementar IA autônoma sem limites;
- enviar campanhas em massa sem controle de opt-in, histórico e regra anti-spam;
- alterar tabelas legadas do motor de reservas sem necessidade explícita;
- misturar regras comerciais de hospedagem diretamente dentro de componentes React;
- depender do WhatsApp Web;
- tratar `@lid` como telefone real.

## 4. Canais suportados

### Agora

- WhatsApp via Evolution API.

### Futuro

- Chat do site.
- Formulários do motor de reservas.
- Campanhas de recuperação.

Todos os canais devem convergir para o mesmo modelo:

```txt
Contact → Conversation → Message → PipelineCard → InternalActionLog
```

## 5. Requisitos funcionais

### RF01 — Contatos

O sistema deve criar ou atualizar contatos a partir de mensagens recebidas.

Campos mínimos:

- nome;
- telefone normalizado quando existir;
- WhatsApp JID;
- LID quando existir;
- origem;
- data de criação;
- data de atualização.

### RF02 — Identidade WhatsApp

O sistema deve diferenciar:

- telefone real: `5511999999999@s.whatsapp.net`;
- grupo: `@g.us`;
- LID: `@lid`.

O sistema não deve salvar LID como telefone.

### RF03 — Conversas

O sistema deve manter uma conversa aberta por contato e canal, salvo quando houver regra explícita para encerrar/reabrir.

### RF04 — Mensagens

O sistema deve salvar mensagens recebidas e enviadas com:

- direção: `inbound` ou `outbound`;
- canal;
- tipo;
- texto;
- mídia, quando existir;
- externalId da Evolution API, quando existir;
- status;
- timestamp.

### RF05 — Inbox

O sistema deve exibir conversas ordenadas pela última mensagem.

Deve exibir:

- nome do contato;
- telefone ou identificador;
- prévia da última mensagem;
- horário;
- badge de não lidas futuramente;
- status da automação.

### RF06 — Resposta manual

O atendente deve conseguir responder uma conversa pelo CRM.

Ao enviar:

- enviar mensagem pela Evolution API;
- salvar mensagem no banco;
- atualizar `lastMessageAt`;
- atualizar preview;
- registrar log;
- pausar automação por janela configurável.

### RF07 — Kanban

O CRM deve criar ou atualizar card automaticamente conforme eventos comerciais.

Estágios recomendados:

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

### RF08 — Atualização automática do Kanban

O Kanban deve ser atualizado por eventos internos e por chamadas autenticadas da API do CRM.

Exemplo:

```txt
MessageReceived → LeadCreated → QualificationUpdated → QuoteSent → ReservationStarted
```

### RF09 — Integração futura com n8n

O n8n deve poder:

- receber eventos do CRM;
- classificar intenção;
- consultar API do CRM/motor de reservas;
- chamar endpoints internos para atualizar pipeline;
- solicitar envio de mensagens;
- registrar automações.

O n8n não deve:

- gravar direto no banco;
- criar reservas sem API validada;
- mover Kanban sem registrar motivo;
- responder conversa pausada por humano.

### RF10 — Logs internos

Toda ação importante deve ser registrada:

- mensagem recebida;
- mensagem enviada;
- card criado;
- card movido;
- chatbot ativado/desativado;
- humano assumiu conversa;
- erro de envio;
- automação executada;
- integração n8n chamada.

## 6. Requisitos não funcionais

- TypeScript estrito sempre que possível.
- Rotas API com validação defensiva.
- Operações críticas com transação.
- Evitar duplicidade por `externalId`.
- Não quebrar motor de reservas existente.
- Não renomear tabelas antigas.
- Não remover migrations existentes.
- Código modular em `src/lib/crm` e `src/lib/whatsapp`.
- UI simples antes de UI bonita.
- Logs antes de automação complexa.

## 7. Critérios de aceite

A fase atual estará aceitável quando:

- uma mensagem real recebida no WhatsApp aparecer na Inbox;
- a conversa abrir com histórico correto;
- o atendente responder pelo CRM;
- a resposta chegar no WhatsApp;
- a mensagem enviada ficar registrada no banco;
- o card do lead existir no Kanban;
- o card puder ser movido manualmente;
- uma automação futura puder mover o card via API;
- chatbot puder ser pausado por conversa;
- logs mostrarem o que aconteceu.
