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

## Próxima microtarefa

F2.05 deve transformar as fixtures Meta em eventos normalizados de texto,
botão, lista, imagem, documento e status.
