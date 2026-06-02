# Automação CRM Delplata com n8n

Este diretório contém os workflows modulares para orquestração do CRM Delplata.

## Estrutura de Workflows

Os workflows são divididos em módulos para facilitar a manutenção e escalabilidade:

1.  `01-crm-events-router.json`: Roteador principal que recebe webhooks do CRM e dispara os fluxos específicos.
2.  `02-quote-requested.json`: Processamento de orçamentos (Disponibilidade -> WhatsApp -> Pipeline).
3.  `03-faq-answer.json`: Respostas automáticas baseadas em regras do CRM.
4.  `04-reservation-intent.json`: Gestão de intenção de reserva e instruções de pagamento.
5.  `05-quote-follow-up.json`: Lembretes automáticos de orçamentos pendentes.
6.  `06-upsell-before-checkin.json`: Ofertas de upgrade dias antes da chegada.
7.  `07-no-response-recovery.json`: Recuperação de leads inativos.
8.  `08-human-takeover.json`: Logs de transição para atendimento humano.

## Configuração Necessária

### Variáveis de Ambiente no n8n

Configure estas variáveis globais no seu n8n:

*   `CRM_BASE_URL`: URL base do seu CRM (ex: `https://crm.seudominio.com` ou o túnel do ngrok).
*   `CRM_INTERNAL_API_TOKEN`: O token definido no seu arquivo `.env` do CRM.

### Credenciais

Crie uma credencial do tipo **Header Auth** ou **HTTP Bearer Auth** no n8n:
*   **Name**: CRM Auth
*   **Token**: O valor de `CRM_INTERNAL_API_TOKEN`.

## Como Importar

1.  No n8n, clique em **Workflows** -> **Add Workflow**.
2.  Clique nos três pontos (...) no canto superior direito -> **Import from File**.
3.  Selecione o arquivo JSON desejado nesta pasta.
4.  **Importante**: Ative o workflow após importar.

## Como Testar

Para testar o fluxo completo sem depender de mensagens reais de WhatsApp:

1.  Identifique um `conversationId` e `pipelineCardId` existentes no seu banco.
2.  Dispare um POST para o webhook do n8n (endpoint do Workflow 01):
    ```bash
    curl -X POST https://seu-n8n.webhook.com/crm-events \
      -H "Authorization: Bearer SEU_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "eventType": "QUOTE_REQUESTED",
        "conversationId": "ID_AQUI",
        "pipelineCardId": "ID_AQUI",
        "metadata": {
          "checkin": "2026-06-15",
          "checkout": "2026-06-17",
          "adults": 2,
          "children": 0
        }
      }'
    ```

## Observabilidade e Logs

*   Toda ação do n8n gera um `InternalActionLog` no CRM.
*   Erros nas chamadas de API são capturados e registrados como Notas no Card do Pipeline.
*   Consulte `/admin/crm/events` no CRM para ver o rastro dos eventos disparados.
