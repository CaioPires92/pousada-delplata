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

## Próxima microtarefa

F2.08 deve implementar envio de template aprovado com nome, idioma e
parâmetros tipados.
