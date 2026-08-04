# Runbook — WhatsApp do CRM com Evolution API

## Arquitetura ativa

`WHATSAPP_PROVIDER=evolution` seleciona a Evolution como canal do CRM. Todos os
envios ativos (Inbox, worker, ações internas, follow-ups e chatbot) atravessam o
contrato `MessagingProvider`. A implementação Meta e suas variáveis permanecem
no repositório, isoladas e inativas.

O webhook Evolution ativo é `/api/whatsapp/webhook` (ou as URLs por evento
abaixo dele). Mensagens entram no fluxo CRM legado já estabilizado e também na
inbox técnica `MessagingWebhookEvent`. Atualizações de entrega são correlacionadas
por `externalMessageId` e atualizam `Message.deliveryStatus` monotonicamente.

## Variáveis obrigatórias

```dotenv
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=https://evolution.exemplo.com
EVOLUTION_API_KEY=troque-por-segredo-forte
EVOLUTION_INSTANCE_NAME=delplata
EVOLUTION_WEBHOOK_SECRET=troque-por-outro-segredo-forte
CRM_INTERNAL_API_TOKEN=troque-por-token-interno-forte
```

O segredo do webhook deve ser diferente da API key. Não versionar `.env`, não
copiar respostas brutas do provedor para logs e não expor esses valores ao
browser. Em produção, a rota falha fechada se o segredo estiver ausente.

## Subir a infraestrutura local

O compose existente usa Evolution API `v2.3.7`, PostgreSQL e Redis. Desde a
versão 2.3.0, a imagem oficial é publicada como `evoapicloud/evolution-api`:

```bash
npm run crm:docker:up
npm run crm:docker:logs
```

Depois, execute uma operação por vez:

```bash
npm run crm:evolution:create
npm run crm:evolution:connect
npm run crm:evolution:qr
npm run crm:evolution:webhook
node --env-file=.env scripts/crm/integration/evolution-client.mjs connection-state
node --env-file=.env scripts/crm/integration/evolution-client.mjs find-webhook
```

O QR é salvo em `scratch/qrcode.html`; ele não deve ser commitado nem publicado.
Para exclusão deliberada da instância, use `npm run crm:evolution:delete`.

## Webhook e rede

`CRM_WEBHOOK_URL` pode informar a URL pública exata. Se omitida, o script usa
`CRM_WEBHOOK_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL` ou
`BASE_URL`. Para Docker local, `localhost` é convertido em
`host.docker.internal`.

O configurador registra os eventos:

- `MESSAGES_UPSERT`;
- `MESSAGES_UPDATE`;
- `MESSAGES_DELETE`;
- `SEND_MESSAGE`.

Também registra `x-evolution-secret`. A rota rejeita segredo inválido, instância
divergente e corpo acima de 256 KiB. Nunca configure Meta e Evolution para
consumir simultaneamente o mesmo número.

## Verificação

Health check interno:

```bash
curl -H "Authorization: Bearer $CRM_INTERNAL_API_TOKEN" \
  https://crm.exemplo.com/api/crm/messaging/health
```

E2E real é opt-in e envia uma mensagem:

```dotenv
EVOLUTION_TEST_RECIPIENT=5511999999999
EVOLUTION_E2E_ENABLED=true
EVOLUTION_E2E_WEBHOOK_TIMEOUT_MS=60000
EVOLUTION_E2E_WEBHOOK_POLL_INTERVAL_MS=1000
```

```bash
node --env-file=.env --import tsx scripts/crm/integration/evolution-e2e.ts
```

O E2E só termina com evidência de status recebida pelo webhook e persistida no
banco. Desative `EVOLUTION_E2E_ENABLED` imediatamente depois do teste.

Gates sem rede real:

```bash
npm run typecheck
npm run test:crm
npm run build
node node_modules/eslint/bin/eslint.js src/lib/messaging src/app/api/whatsapp
```

## Implantação e rollback

1. Fazer backup do banco e confirmar migrations existentes de mensageria.
2. Implantar o CRM com `WHATSAPP_PROVIDER=evolution` e segredos server-side.
3. Confirmar health check, webhook configurado e uma única instância conectada.
4. Executar E2E para um destinatário autorizado.
5. Liberar worker/automações gradualmente e observar fila/dead-letter.

Em incidente: pausar automações, preservar IDs/logs sanitizados, impedir novos
envios, corrigir por forward-fix ou `git revert` e só então reprocessar jobs
idempotentes. A implementação Meta não é ativada automaticamente; qualquer
troca futura exige credenciais válidas, webhook exclusivo e teste controlado.

## Limites conhecidos

- Templates do contrato Meta não são enviados pela integração Evolution; os
  fluxos ativos deste CRM usam texto.
- O E2E real depende de uma instância conectada, URL pública alcançável e número
  destinatário autorizado; os testes automatizados não usam segredos reais.
- Evolution com Baileys não é a API oficial do WhatsApp. Atualizações da imagem
  devem passar pelos mesmos testes de payload e pelo E2E antes de produção.
