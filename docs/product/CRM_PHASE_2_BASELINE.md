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

## Próxima microtarefa

F2.02 deve adicionar fixtures sanitizadas e representativas dos webhooks da
Meta, sem telefone, token ou conteúdo real de hóspedes.
