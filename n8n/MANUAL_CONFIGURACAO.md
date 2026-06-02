# Manual de Importação e Configuração — n8n Delplata

Este guia orienta a configuração do ecossistema de automação no n8n para integração com o CRM Delplata.

## 1. Pré-requisitos

Antes de começar, certifique-se de ter:
*   Acesso ao seu painel n8n.
*   O token `CRM_INTERNAL_API_TOKEN` definido no arquivo `.env` do seu CRM.
*   Uma `OPENAI_API_KEY` válida.
*   A URL base do seu CRM (ex: `https://seu-ngrok.ngrok-free.dev`).

---

## 2. Configurando Variáveis Globais (Passo Único)

Para não precisar configurar a URL e o Token em cada workflow, vamos usar as variáveis globais do n8n:

1.  No n8n, vá em **Settings** (ícone de engrenagem no canto inferior esquerdo).
2.  Clique em **Variables**.
3.  Adicione as seguintes variáveis:
    *   **Key**: `CRM_BASE_URL` | **Value**: `https://seu-crm.com` (sem a barra no final).
    *   **Key**: `CRM_INTERNAL_API_TOKEN` | **Value**: `seu_token_secreto_aqui`.
    *   **Key**: `OPENAI_MODEL` | **Value**: `gpt-4o-mini` (ou outro de sua preferência).
4.  Clique em **Save**.

## 2.1. Configurando Credenciais da OpenAI

Além da variável global, o n8n precisa da credencial oficial:
1.  Vá em **Credentials** no menu lateral.
2.  Clique em **Add Credential**.
3.  Procure por **OpenAI**.
4.  Cole sua **API Key**.
5.  Dê o nome de `OpenAI Account`.

---

## 3. Importando os Workflows

Você deve importar os 8 arquivos JSON localizados na pasta `n8n/workflows/`. Recomendo seguir esta ordem:

### Passo A: Importar os Sub-workflows (02 a 08)
1.  No n8n, clique em **Workflows** -> **Add Workflow**.
2.  **Dica**: Simplesmente arraste o arquivo `.json` do seu computador para dentro da tela branca do n8n. Ele carregará todos os nós automaticamente.
3.  Clique em **Save** e dê o nome original do arquivo (ex: `02-quote-requested`).
4.  **IMPORTANTE**: Ative o workflow (chave "Active" no canto superior direito).
5.  Repita para todos até o `08-human-takeover`.

### Passo B: Importar o Roteador (01-crm-events-router)
1.  Crie um novo workflow e arraste o arquivo `01-crm-events-router.json`.
2.  Este workflow possui nós chamados **Execute Workflow**.
3.  Abra cada um desses nós e, no campo **Workflow**, selecione o workflow correspondente que você importou no Passo A.
4.  Salve e **Ative** este workflow.

---

## 4. Conectando o CRM ao n8n

Agora que o n8n está pronto, precisamos dizer ao CRM para onde enviar os eventos:

1.  Abra o workflow `01-crm-events-router` no n8n.
2.  Clique duas vezes no nó **Webhook CRM**.
3.  Copie a **Production URL** (geralmente algo como `https://seu-n8n.com/webhook/crm-events`).
4.  No arquivo `.env` do seu CRM, atualize a variável:
    ```env
    N8N_WEBHOOK_URL=https://sua-url-copiada-do-n8n.com/webhook/crm-events
    ```
5.  Reinicie o CRM.

---

## 5. Teste de Fogo

Para validar se tudo está conversando:

1.  No n8n, abra o workflow `01-crm-events-router`.
2.  Clique em **Listen for event** (no nó Webhook).
3.  No seu WhatsApp de teste, envie uma mensagem que solicite orçamento (ex: "Quero saber o preço para 2 adultos em junho").
4.  Veja se o n8n "pisca" recebendo o evento e roteando para o workflow `02-quote-requested`.

---

## Solução de Problemas

*   **Erro 401 (Unauthorized)**: Verifique se o `CRM_INTERNAL_API_TOKEN` no n8n é exatamente igual ao do `.env` do CRM.
*   **Workflow não dispara**: Verifique se a chave **Active** está ligada em todos os workflows (Router e Sub-workflows).
*   **n8n não encontra o CRM**: Verifique se a `CRM_BASE_URL` está acessível (se estiver usando ngrok, o túnel deve estar rodando).
