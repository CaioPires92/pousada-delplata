# Revisão diária do shadow mode

Comando:

```bash
npm run crm:shadow:report
```

O comando consulta somente metadados das 25 classificações do dia. Mensagens, nomes,
telefones e outras informações do hóspede não são impressos.

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

O mecanismo de revisão está validado, mas F8.05 só pode ser concluído depois que uma
amostra real for produzida com `CRM_AI_SHADOW_MODE=true` e revisada.
