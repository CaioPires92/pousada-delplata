# Gate de expansão do chatbot

O CRM bloqueia qualquer aumento de respostas automáticas até que haja evidência das
últimas 24 horas.

## Critérios padrão

- pelo menos 20 decisões em shadow mode;
- concordância entre IA e heurística de pelo menos 80%;
- nenhuma ação autorizada durante shadow mode;
- pelo menos 5 sugestões supervisionadas revisadas por atendentes.

Os mínimos de amostra podem ser ajustados por ambiente:

```env
CRM_ROLLOUT_MIN_SHADOW_SAMPLE=20
CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS=5
```

## Limites de expansão

- somente uma nova intenção por alteração;
- aumento máximo de 5 pontos percentuais por alteração;
- reduções de percentual e remoções de intenção permanecem sempre disponíveis;
- conversa de teste continua isolada do rollout de produção.

O estado do gate e suas métricas aparecem em **Administração > Chatbot**, abaixo do
controle percentual. A API responde `409 rollout_gate_blocked` se os critérios ainda
não estiverem satisfeitos.
