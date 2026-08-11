# Relatório de carga do CRM

## Perfil reproduzível

Comando:

```bash
npm run test:crm:load
```

O executor cria um banco SQLite temporário, aplica o schema atual, desativa integrações externas e remove todo o ambiente ao terminar. Nenhuma mensagem real é enviada.

## Execução de 11/08/2026

| Superfície | Carga | Resultado | Tempo |
| --- | ---: | --- | ---: |
| Webhook | 100 eventos + 100 reentregas | 100 aceitos e 100 deduplicados | 21.932 ms |
| Inbox | merge e ordenação de 10.000 conversas | sem perda ou duplicação | 31 ms |
| Cotação | 100 cálculos concorrentes | opções e disponibilidade consistentes | 28 ms |
| Scheduler | 30 jobs persistidos | 30 processados exatamente uma vez | 13.243 ms |

Resultado: **4/4 cenários aprovados**.

Durante a primeira execução, as gravações paralelas do webhook saturaram o SQLite. A persistência foi alterada para serializar as escritas dentro de cada entrega; a segunda execução eliminou os timeouts e preservou a deduplicação.

Este perfil é um gate de regressão e concorrência no ambiente local isolado. Os tempos não representam capacidade de produção da infraestrutura hospedada; a validação de produção deve observar as métricas do dashboard durante o piloto.
