# Revisão diária do shadow mode

Comando:

```bash
npm run crm:shadow:report
```

O comando consulta somente metadados das 25 classificações do dia. Mensagens, nomes,
telefones e outras informações do hóspede não são impressos.

## Provider de IA

O classificador aceita OpenAI e Gemini sem alterar o contrato de decisão. Selecione um
provider no `.env` e mantenha as chaves somente no servidor:

```env
# Alternativa gratuita para o piloto com mensagens sintéticas/de teste.
CRM_AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
CRM_AI_SHADOW_MODE=true
```

O provider Gemini usa saída JSON, nível baixo de raciocínio e limite de cinco segundos.
Erro, timeout, chave ausente, provider desconhecido ou resposta inválida sempre retornam
ao classificador determinístico e nunca autorizam uma ação. A camada gratuita do Gemini
não deve receber dados pessoais reais; use-a apenas no piloto controlado.

## Gate

O shadow mode é considerado aprovado no dia somente quando:

- existe pelo menos uma decisão com `mode=shadow`;
- nenhuma decisão possui `actionAuthorized=true`;
- a amostra é revisada na tela **Chatbot > Revisão das decisões**.

## Execução de 11/08/2026

- Classificações encontradas hoje: 0.
- Decisões em shadow: 0.
- Ações autorizadas em shadow: 0.
- Gate: pendente por ausência de amostra.

O provider Gemini foi validado em 11/08/2026 com uma classificação real, sem envio de
mensagem. Essa chamada isolada não conta como amostra persistida do webhook.

O mecanismo de revisão está validado, mas F8.05 só pode ser concluído depois que uma
amostra real for produzida com `CRM_AI_SHADOW_MODE=true` e revisada.
