# Runbook de incidentes do CRM Delplata

## Responsabilidade

- Responsável de primeiro atendimento: recepcionista responsável pelo turno.
- Responsável técnico: administrador do CRM designado pela Pousada Delplata.
- Escalonamento operacional: gerência da pousada.
- Fonte de verdade durante o incidente: Inbox do CRM e WhatsApp conectado à Evolution.

O nome e o telefone das pessoas de plantão devem permanecer no procedimento interno da
pousada, não neste repositório. No início de cada turno, a recepção confirma quem ocupa
as três funções acima.

## Severidades

| Nível | Exemplo | Ação inicial |
| --- | --- | --- |
| S1 | mensagens erradas/repetidas ou risco de dados cruzados | desligar bot imediatamente |
| S2 | envio/recebimento indisponível, fila crescendo ou Evolution desconectada | assumir atendimento manual e diagnosticar |
| S3 | automação/IA degradada sem impacto no atendimento manual | manter bot desligado para o fluxo afetado e corrigir |

## Contenção imediata

1. Abra **Administração > Chatbot**.
2. Use **DESATIVAR BOT GERAL**. O Kanban pode continuar ligado.
3. Nas conversas afetadas, selecione **Desligado** e assuma o atendimento.
4. Não reenvie jobs ou mensagens antes de confirmar se já chegaram ao hóspede.
5. Registre horário, conversa afetada, sintoma e ação tomada sem copiar segredos.

Se a interface estiver indisponível, interrompa o worker/scheduler e mantenha o
atendimento diretamente pelo WhatsApp até o CRM voltar. Não derrube Evolution quando o
problema estiver apenas no chatbot, pois isso também interrompe o recebimento manual.

## Diagnóstico

```bash
node --env-file=.env scripts/crm/integration/evolution-client.mjs connection-state
npm run crm:shadow:report
docker compose --env-file .env -f evolution-docker/docker-compose.yml ps
docker compose --env-file .env -f evolution-docker/docker-compose.yml logs --tail=200 evolution-api
```

No CRM, verifique **Dashboard**, **Eventos operacionais**, **Jobs de automação** e o
histórico da conversa. Nunca cole chaves, tokens ou payloads completos em tickets.

## Recuperação

1. Corrija a causa com o bot geral ainda desligado.
2. Execute `npm run typecheck`, `npm run test:crm:security` e os testes do componente alterado.
3. Execute `npm run test:crm:drill` para validar kill switch e replay isoladamente.
4. Reprocesse um dead-letter por vez pela ação autenticada de replay.
5. Confirme que a conversa está em `off` ou `supervised` antes de processar o job.
6. Valide recebimento com a conversa de teste da pousada.
7. Reative primeiro em `supervised`; só retorne a `auto` após aprovação da gerência.

## Rollback

- Aplicação: volte ao último commit validado da branch de desenvolvimento por um deploy novo; não use `git reset --hard` no workspace.
- Configuração: desligue o bot geral e restaure apenas os valores documentados anteriormente.
- Banco: restaure o backup verificado quando uma migration for a causa. Não apague migrations já aplicadas.
- Evolution: preserve instância e credenciais; troque a imagem somente pela versão anteriormente validada.

## Critérios de encerramento

- envio e recebimento testados sem duplicidade;
- fila sem jobs vencidos inesperados;
- dead-letters revisados individualmente;
- nenhuma ação autorizada em shadow mode;
- atendimento humano e reserva pelo site funcionando;
- causa, impacto, correção e prevenção registrados;
- gerência autoriza formalmente qualquer aumento de rollout.

## Exercício periódico

Execute `npm run test:crm:drill` após mudanças em chatbot, fila, provider ou migrations e,
no mínimo, antes de cada nova etapa de rollout. O resultado inicial está documentado em
[CRM_RECOVERY_DRILL_REPORT.md](./CRM_RECOVERY_DRILL_REPORT.md).
