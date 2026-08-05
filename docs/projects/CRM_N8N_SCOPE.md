# Escopo do Projeto: CRM e automação futura

## Objetivo
Centralizar atendimento (WhatsApp/site), pipeline comercial e automações sem quebrar o motor de reservas.

## Entradas
- webhook da Evolution API;
- ações humanas no painel CRM;
- eventos internos do CRM.

## Saídas
- mensagens de resposta;
- mudanças de estágio no pipeline;
- logs de auditoria;
- chamadas externas de automação quando a nova integração existir.

## Módulos principais
- `src/app/admin/inbox/*`
- `src/app/admin/crm/*`
- `src/app/api/whatsapp/*`
- `src/app/api/crm/*`
- `src/lib/whatsapp/*`
- `src/lib/crm/*`

## Banco
- `Contact`, `Conversation`, `Message`, `PipelineCard`, `InternalActionLog` e tabelas auxiliares de automação.

## Regra operacional
- integrações externas não acessam banco diretamente; usam API interna autenticada.

## Autoridade e limites

O n8n é um orquestrador externo. Ele pode receber eventos sanitizados, criar
notificações e chamar APIs internas explicitamente autorizadas. Ele não pode:

- acessar o banco do CRM diretamente;
- calcular preço ou disponibilidade;
- confirmar reserva ou pagamento;
- enviar WhatsApp diretamente pela Evolution API;
- modificar o funil sem usar uma API interna autenticada e validada.

O CRM continua sendo a fonte de verdade e o único responsável por autorizar
ações de negócio e mensagens.

## Configuração do webhook n8n

O workflow inicial está versionado em
`n8n/workflows/crm-event-ingress.json`. Ele é deliberadamente importado
inativo e contém uma referência de credencial fictícia. Antes de ativá-lo:

1. importe o JSON no n8n;
2. crie uma credencial **Header Auth** chamada `CRM Delplata - Bearer`;
3. use `Authorization` como nome e `Bearer <N8N_WEBHOOK_TOKEN>` como valor;
4. selecione essa credencial no nó `Receber evento do CRM`;
5. salve e ative o workflow;
6. use `http://localhost:5678/webhook/crm-delplata-events` no `.env` do CRM.

Não importe nem ative o workflow enquanto a credencial ainda aparecer como
`CONFIGURE_IN_N8N`.

No nó **Webhook** do n8n:

1. use o método `POST`;
2. em produção, use a URL `/webhook/...`, não `/webhook-test/...`;
3. selecione autenticação por cabeçalho;
4. configure o cabeçalho `Authorization` com o valor
   `Bearer <N8N_WEBHOOK_TOKEN>`;
5. responda com HTTP `2xx` rapidamente;
6. use `eventId` ou o cabeçalho `X-CRM-Event-ID` para deduplicar execuções.

No CRM:

```dotenv
N8N_ENABLED=false
N8N_WEBHOOK_URL=http://localhost:5678/webhook/seu-id
N8N_WEBHOOK_TOKEN=gere-um-segredo-exclusivo
N8N_TIMEOUT_MS=3000
N8N_MAX_ATTEMPTS=3
```

`N8N_WEBHOOK_TOKEN` deve ser diferente de `CRM_INTERNAL_API_TOKEN`. O primeiro
protege eventos enviados pelo CRM ao n8n. O segundo autentica chamadas do n8n
para APIs internas do CRM.

## Contrato de eventos

O CRM envia envelope JSON versão 1:

```json
{
  "version": 1,
  "eventId": "id-idempotente",
  "event": "MessageReceived",
  "occurredAt": "2026-08-05T18:30:00.000Z",
  "resources": {
    "contactId": "id-interno",
    "conversationId": "id-interno"
  },
  "data": {
    "channel": "whatsapp",
    "messageType": "text"
  }
}
```

Texto da conversa, telefone, nome, e-mail, CPF, tokens e payloads brutos não são
incluídos. Somente eventos e campos explicitamente permitidos atravessam essa
fronteira.

## Fila, retry e falhas

- O evento é registrado primeiro no `InternalActionLog`.
- Eventos permitidos entram em `AutomationQueueJob` com ação
  `EMIT_N8N_EVENT`.
- O worker usa timeout limitado e até três tentativas para rede, `408`, `425`,
  `429` e respostas `5xx`.
- Erros permanentes `4xx` não são repetidos.
- Falha final segue para a dead-letter existente, sem interromper o atendimento.
- `N8N_ENABLED=false` mantém toda emissão externa desligada.

O processamento usa o endpoint protegido já existente:

```bash
curl -X POST http://localhost:3001/api/cron/crm-queue-worker \
  -H "Authorization: Bearer $CRM_INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxConversations":20}'
```

## Teste ponta a ponta opt-in

Depois de ativar o workflow e configurar a URL de produção e o segredo, execute
temporariamente:

```bash
N8N_E2E_ENABLED=true \
N8N_ENABLED=true \
node --env-file=.env --import tsx scripts/crm/integration/n8n-e2e.ts
```

Opcionalmente, defina `N8N_E2E_CONVERSATION_ID` para escolher uma conversa
ociosa. O runner recusa conversas com jobs pendentes, envia apenas um envelope
sintético sem dados de hóspede e comprova que o job foi concluído. Depois do
teste, mantenha `N8N_ENABLED=false` até revisar a execução no n8n.
