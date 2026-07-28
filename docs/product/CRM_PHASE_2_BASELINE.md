# Fase 2 — Adaptador de canal e WhatsApp Meta

## F2.01 — Contrato normalizado de mensageria

O contrato independente de provedor está em
`src/lib/messaging/provider.ts`.

`MessagingProvider` define duas fronteiras:

- normalização de um webhook bruto em eventos internos;
- envio de mensagens por um contrato interno.

Os eventos recebidos usam IDs externos para mensagem e evento, timestamp,
remetente, destinatário e conteúdo discriminado. O contrato cobre texto,
botão, lista, imagem, documento, tipo desconhecido e os estados `sent`,
`delivered`, `read` e `failed`.

O contrato de saída cobre texto e template tipado. Nenhum tipo expõe payloads
específicos da Evolution ou da Meta. A implementação atual da Evolution ainda
não foi migrada para essa interface; essa troca será incremental.

### Evidência

- 14 testes de contrato aprovados;
- typecheck aprovado;
- a pasta `src/lib/messaging` faz parte do runner isolado do CRM;
- gate CRM: 22 arquivos e 77 testes aprovados.

## F2.02 — Fixtures sanitizadas da Meta

As fixtures em `src/lib/messaging/fixtures/meta` reproduzem o envelope oficial
do webhook da Meta com dados exclusivamente sintéticos.

O conjunto cobre:

- mensagem de texto;
- resposta de botão;
- resposta de lista;
- imagem;
- documento;
- estados `sent`, `delivered`, `read` e `failed`.

Todos os identificadores usam marcadores explícitos de teste. Um teste de
segurança percorre os arquivos e bloqueia URL externa, cabeçalho Bearer, nomes
comuns de segredo, formato de telefone brasileiro e padrão de token Meta.

### Evidência

- testes direcionados de mensageria: 2 arquivos e 17 testes aprovados;
- typecheck aprovado;
- gate CRM: 23 arquivos e 80 testes aprovados.

## F2.03 — Desafio de verificação do webhook

`GET /api/whatsapp/meta/webhook` implementa o handshake de inscrição exigido
pela Meta.

A rota:

- aceita somente `hub.mode=subscribe`;
- compara `hub.verify_token` com `META_WHATSAPP_VERIFY_TOKEN`;
- devolve exatamente `hub.challenge` em texto simples quando válida;
- responde `403` sem expor o challenge quando a requisição é inválida;
- falha fechada com `503` quando o token não está configurado.

A comparação do token usa `timingSafeEqual`. O endpoint legado da Evolution
permanece separado e inalterado.

### Evidência

- 5 testes direcionados aprovados;
- typecheck aprovado;
- gate CRM: 24 arquivos e 85 testes aprovados.

## F2.04 — Assinatura do webhook Meta

`POST /api/whatsapp/meta/webhook` lê o corpo como texto e valida
`X-Hub-Signature-256` com HMAC SHA-256 e `META_WHATSAPP_APP_SECRET` antes de
interpretar o JSON.

A validação:

- exige o prefixo `sha256=` e exatamente 64 caracteres hexadecimais;
- calcula o HMAC sobre os bytes do corpo recebido;
- compara os digests com `timingSafeEqual`;
- responde `401` para assinatura ausente, malformada ou incorreta;
- falha fechada com `503` quando o segredo não está configurado;
- somente após autenticar tenta interpretar o JSON.

### Evidência

- 13 testes direcionados aprovados;
- um caso com JSON inválido e assinatura inválida comprova a ordem da proteção;
- typecheck aprovado;
- gate CRM: 24 arquivos e 93 testes aprovados.

## F2.05 — Normalização dos eventos Meta

`normalizeMetaWebhook` percorre todas as entradas e mudanças do envelope Meta e
produz o contrato interno definido em F2.01.

O mapeamento cobre:

- texto;
- resposta de botão;
- resposta de lista;
- imagem e documento com ID de mídia;
- tipo desconhecido sem descartar o evento;
- status `sent`, `delivered`, `read` e `failed`, incluindo erro sanitizado.

IDs de evento são determinísticos a partir do ID externo, status e timestamp.
Payloads malformados ou não relacionados são ignorados sem lançar exceção. A
rota executa a normalização somente depois de autenticar a assinatura e
validar o JSON.

### Evidência

- testes direcionados: 3 arquivos e 27 testes aprovados;
- todos os eventos produzidos passam pelo validador do contrato normalizado;
- typecheck aprovado;
- gate CRM: 25 arquivos e 104 testes aprovados.

## F2.06 — Persistência e deduplicação

A migration `20260728163000_add_messaging_webhook_events` cria a inbox técnica
`MessagingWebhookEvent`.

Cada evento normalizado é persistido com:

- provedor;
- ID externo do evento;
- tipo `message` ou `status`;
- ID externo da mensagem;
- evento normalizado;
- estado de processamento.

O payload bruto e as credenciais da Meta não são armazenados. A restrição
única `(provider, externalEventId, eventKind)` é a autoridade de concorrência:
uma colisão `P2002` é contabilizada como duplicata, enquanto outros erros de
banco continuam interrompendo a operação.

### Evidência

- testes unitários direcionados: 2 arquivos e 16 testes aprovados;
- teste com banco SQLite isolado envia o mesmo evento simultaneamente e
  confirma exatamente uma linha;
- typecheck aprovado;
- gate CRM: 27 arquivos e 108 testes aprovados.

## F2.07 — Envio de texto pela Cloud API

`MetaMessagingProvider` implementa o contrato comum de mensageria e envia texto
para `/{phone-number-id}/messages`.

O envio inclui:

- autenticação Bearer somente no servidor;
- `messaging_product=whatsapp`;
- destinatário individual;
- texto com preview de URL desabilitado;
- contexto opcional para resposta;
- captura do `wamid` retornado pela Meta.

A versão da Graph API é obrigatória em
`META_WHATSAPP_GRAPH_API_VERSION`, evitando uma versão implícita no código.
Erros retornam apenas categoria e status HTTP controlados, sem copiar resposta
do provedor ou token. Templates permanecem bloqueados até F2.08.

O provedor foi implementado, mas ainda não foi conectado aos fluxos ativos:
Evolution continua sendo o padrão até a troca explícita por feature flag.

### Evidência

- 8 testes direcionados aprovados, sem chamada de rede real;
- typecheck aprovado;
- gate CRM: 28 arquivos e 116 testes aprovados.

## F2.08 — Template aprovado e parâmetros tipados

`MetaMessagingProvider` agora envia templates aprovados usando nome e idioma
explícitos. O contrato interno aceita parâmetros tipados de:

- texto;
- moeda, com valor alternativo, código ISO e valor em milésimos;
- data e hora, com valor alternativo.

O adaptador converte o contrato interno em componentes no formato da Cloud
API, incluindo os campos `fallback_value`, `amount_1000` e `date_time`.
Templates sem parâmetros omitem `components`.

Antes de qualquer chamada HTTP, o provedor valida o nome do template, o código
de idioma e todos os parâmetros. Respostas de erro permanecem sanitizadas e
não expõem token, payload sensível ou corpo retornado pela Meta.

### Evidência

- testes direcionados: 2 arquivos e 28 testes aprovados;
- casos válidos cobrem texto, moeda, data/hora e template sem parâmetros;
- casos inválidos comprovam que nenhuma chamada HTTP é iniciada;
- typecheck aprovado;
- gate CRM: 28 arquivos e 122 testes aprovados.

## F2.09 — Persistência sanitizada de status e erro

A migration `20260728174500_add_message_delivery_status` adiciona à mensagem
correlacionada:

- estado de entrega;
- código, título e detalhe do erro;
- horário da última atualização de entrega.

O webhook Meta correlaciona cada evento pelo `externalMessageId`. A atualização
é monotônica pelo horário informado pelo provedor, impedindo que um evento
atrasado substitua um estado mais recente.

Campos de erro são limitados a 500 caracteres e padrões de credencial são
redigidos antes da persistência. A mesma sanitização protege tanto a mensagem
quanto a inbox técnica de webhooks; token e payload bruto não são gravados.
Um status bem-sucedido posterior limpa o erro anterior.

### Evidência

- testes direcionados: 3 arquivos e 20 testes aprovados;
- teste com SQLite isolado confirma a migration, a correlação e a proteção
  contra eventos fora de ordem;
- teste de segurança confirma que credenciais sintéticas não chegam ao JSON
  persistido;
- typecheck aprovado;
- gate CRM: 30 arquivos e 127 testes aprovados.

## F2.10 — Retry transitório com backoff e jitter

O envio pela Meta executa no máximo três tentativas por padrão. Somente falhas
de rede e respostas HTTP `408`, `425`, `429` ou `5xx` são repetidas.

Entre tentativas, o provedor usa backoff exponencial com full jitter, partindo
de 250 ms e limitado a 5 segundos. Erros permanentes `4xx`, configuração
ausente, mensagem inválida e resposta bem-sucedida sem ID externo falham sem
retry.

Após esgotar as tentativas, o erro retornado permanece controlado e não inclui
token nem mensagem original da falha de rede. As opções de tempo, espera e
aleatoriedade são injetáveis para testes determinísticos.

### Evidência

- 20 testes direcionados aprovados;
- falhas `500` e `429` comprovam backoff crescente e jitter;
- erros permanentes `400`, `401`, `403` e `404` comprovam tentativa única;
- falha de rede comprova limite de tentativas e erro sanitizado;
- typecheck aprovado;
- gate CRM: 30 arquivos e 133 testes aprovados.

## F2.11 — Circuit breaker e dead-letter

O worker de mensageria agora envolve somente a chamada externa com um circuit
breaker independente do fornecedor. Validação de payload permanece fora do
breaker e não afeta a saúde do provedor.

O circuito:

- abre após cinco falhas consecutivas contabilizáveis;
- bloqueia novas chamadas por 30 segundos;
- permite uma única sonda no estado `half_open`;
- fecha após recuperação bem-sucedida;
- não contabiliza falhas explicitamente marcadas como permanentes.

O provedor Meta classifica erros transitórios e permanentes no erro controlado.
Quando uma execução da fila falha ou encontra o circuito aberto, o job existente
é encaminhado à dead-letter. O motivo é redigido e limitado a 500 caracteres
antes de ser salvo, sem token ou credencial.

O breaker está no ponto compartilhado do worker: protege Evolution enquanto ela
é o rollback ativo e continuará protegendo a Meta após a troca por feature flag.

### Evidência

- testes direcionados: 3 arquivos e 28 testes aprovados;
- testes cobrem abertura, bloqueio, recuperação, falha permanente e sonda única;
- teste da fila comprova dead-letter com motivo sanitizado e limitado;
- typecheck aprovado;
- gate CRM: 31 arquivos e 138 testes aprovados.

## F2.12 — Variáveis Meta sanitizadas

O `.env.example` contém, uma única vez e sem valor:

- `META_WHATSAPP_ACCESS_TOKEN`;
- `META_WHATSAPP_APP_SECRET`;
- `META_WHATSAPP_VERIFY_TOKEN`;
- `META_WHATSAPP_PHONE_NUMBER_ID`;
- `META_WHATSAPP_BUSINESS_ACCOUNT_ID`;
- `META_WHATSAPP_GRAPH_API_VERSION`.

O padrão `WHATSAPP_PROVIDER=evolution` mantém a migração desligada até a troca
explícita por feature flag. Um teste de contrato impede a remoção, duplicação
ou inclusão acidental de valores reais nessas variáveis.

### Evidência

- 2 testes direcionados aprovados;
- typecheck aprovado;
- gate CRM: 32 arquivos e 140 testes aprovados.

## F2.13 — Health check do provedor Meta

O endpoint interno `GET /api/crm/messaging/health` consulta a lista de números
do WABA pela Graph API e confirma que o `PHONE_NUMBER_ID` configurado pertence
à conta.

A verificação:

- exige `CRM_INTERNAL_API_TOKEN`;
- realiza somente leitura e nunca envia mensagem;
- usa timeout de 5 segundos;
- distingue configuração ausente, indisponibilidade, erro HTTP, resposta
  inválida e número divergente;
- retorna somente estado, motivo controlado, status HTTP e qualidade;
- não expõe token, WABA, número exibido ou nome verificado.

### Evidência

- testes direcionados: 2 arquivos e 7 testes aprovados;
- typecheck aprovado;
- primeira execução do gate identificou timeout de infraestrutura em um teste
  SQLite anterior; o limite explícito foi corrigido em microcommit separado;
- gate CRM repetido: 34 arquivos e 147 testes aprovados.

## F2.14 — Preparação do E2E real (pendente operacionalmente)

Foi criado um runner dedicado para o teste ponta a ponta com a Meta. Ele falha
fechado por padrão e somente permite envio quando `META_E2E_ENABLED=true` é
definido explicitamente. O destinatário também é isolado em
`META_WHATSAPP_TEST_RECIPIENT` e validado no formato E.164 sem o sinal `+`.

O comando `npm run crm:meta:e2e` retorna apenas evidência sanitizada: fornecedor,
ID externo, horário de aceite e status. Tokens, destinatário e conteúdo não são
incluídos na saída.

Nenhum envio real foi executado porque as credenciais Meta e o número de teste
não estão configurados no ambiente local. Por isso, F2.14 permanece aberta.

### Evidência da preparação

- 3 arquivos e 25 testes direcionados aprovados;
- execução com o ambiente atual recusada antes de qualquer chamada de rede;
- typecheck aprovado;
- gate CRM: 35 arquivos e 150 testes aprovados.

## Próxima microtarefa

Executar e registrar o envio e o recebimento reais usando credenciais
operacionais autorizadas. F2.15 somente começa após essa evidência concluir a
F2.14.
