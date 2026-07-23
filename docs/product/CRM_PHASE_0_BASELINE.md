# Fase 0 — Baseline inicial

**Data:** 2026-07-22
**Objetivo:** tornar a validação repetível e impedir chamadas externas durante testes.

## Evidências iniciais

- `npm run typecheck`: aprovado em aproximadamente 29 segundos.
- suíte CRM após correção: 19 arquivos, 57 testes aprovados em aproximadamente 38 segundos.
- suíte Mapa: 7 arquivos, 53 testes aprovados em aproximadamente 71 segundos.
- causa da falha: `startHour: 0` era convertido para `9` por uso de `|| 9`.
- testes carregavam integrações do `.env` e tentavam emitir eventos para n8n.
- webhook concorrente registra `P2002` durante a corrida de deduplicação; o teste passa, mas o tratamento deve ser simplificado na fase do novo webhook Meta.
- o backup `prisma/dev.db.bak` ainda está versionado e precisa de revisão humana antes de eventual remoção do histórico.
- `delplata-arquivos.zip` é local e agora está explicitamente ignorado, sem ser removido.

## Alterações da primeira microentrega

- corrigido parsing de hora que descartava o valor zero;
- bloqueadas URLs/chaves de integrações externas no setup de testes;
- emissão externa agora exige `N8N_ENABLED=true`, URL configurada e ambiente diferente de teste;
- adicionado teste que garante que o ambiente de testes nunca chama webhook externo;
- separados comandos de teste para CRM, Mapa, reservas e UI;
- criado gate `test:gate:crm` com typecheck + suíte CRM;
- zip local incluído no `.gitignore`.

## Limpeza de resíduos CRM

Foram removidos apenas itens sem participação no runtime atual:

- SDD antigo, cujos status divergiam do código e do n8n resetado;
- workflow n8n inativo e documentação de reset;
- runbooks antigos de ngrok, VPS, URLs e persistência do n8n;
- scripts avulsos de diagnóstico/migração CRM sem referências;
- scripts manuais antigos de teste da Evolution sem uso em `package.json`;
- rota pública `/api/test/whatsapp-send`.
- arquivos binários e logs da antiga quarentena `trash/for-review`; continuam recuperáveis pelo histórico Git.

A implementação Evolution usada pelo runtime foi preservada até a conclusão da migração para Meta.

## Comandos

```bash
npm run typecheck
npm run test:crm
npm run test:mapa
npm run test:reservas
npm run test:ui
npm run test:gate:crm
```

## Pendências antes de encerrar a Fase 0

- [ ] Executar cada suíte três vezes e registrar duração/estabilidade.
- [ ] Corrigir testes ou processos restantes que excedam o orçamento.
- [ ] Definir banco efêmero por execução para testes que usam Prisma real.
- [ ] Auditar os dois bancos versionados sem publicar seus dados.
- [ ] Criar CI com os gates separados.
- [ ] Registrar procedimento de rollback e ambiente.
