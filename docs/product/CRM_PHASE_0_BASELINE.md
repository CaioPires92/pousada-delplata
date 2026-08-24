# Fase 0 — Baseline inicial

**Data:** 2026-07-22
**Objetivo:** tornar a validação repetível e impedir chamadas externas durante testes.

**Commit do baseline:** `97105a9`

**Tag local:** `crm-baseline-2026-07-22`

**Publicação da tag:** não realizada.

## Evidências iniciais

- `npm run typecheck`: aprovado em aproximadamente 29 segundos.
- suíte CRM após correção: 19 arquivos, 57 testes aprovados em aproximadamente 38 segundos.
- suíte Mapa: 7 arquivos, 53 testes aprovados em aproximadamente 71 segundos.
- causa da falha: `startHour: 0` era convertido para `9` por uso de `|| 9`.
- testes carregavam integrações do `.env` e tentavam emitir eventos para n8n.
- webhook concorrente registra `P2002` durante a corrida de deduplicação; o teste passa, mas o tratamento deve ser simplificado na fase do novo webhook Meta.
- o backup `prisma/dev.db.bak` ainda está versionado e precisa de revisão humana antes de eventual remoção do histórico.
- `delplata-arquivos.zip` é local e agora está explicitamente ignorado, sem ser removido.

## Revalidação após atualização da branch

**Data:** 2026-07-28
**Ambiente canônico local:** WSL Ubuntu, Node `v22.22.1`, npm `11.14.1`.

A branch de continuação recebeu a `origin/main` atual sem conflitos e o gate foi
executado três vezes no WSL:

| Execução | Typecheck | CRM | Duração da suíte CRM | Duração total |
| --- | --- | --- | ---: | ---: |
| 1, cache frio | aprovado | 20 arquivos / 58 testes | 38,50 s | 144,7 s |
| 2 | aprovado | 20 arquivos / 58 testes | 19,38 s | 37,11 s |
| 3 | aprovado | 20 arquivos / 58 testes | 23,99 s | 33,53 s |

Conclusões:

- o gate foi repetível em três execuções consecutivas;
- nenhuma integração externa foi acionada;
- o cenário `Evolution offline` é uma falha simulada e esperada pelo teste de envio;
- o orçamento de menos de cinco minutos para o gate foi atendido;
- o alvo de menos de 30 segundos para unitários CRM foi atendido nas execuções
  aquecidas; a primeira execução ficou acima do alvo e permanece registrada como
  custo de cache frio;
- nesta cópia do projeto, comandos Node devem ser executados pelo WSL para evitar
  mistura de bindings nativos Windows/Linux no `node_modules`.

## Alterações da primeira microentrega

- corrigido parsing de hora que descartava o valor zero;
- bloqueadas URLs/chaves de integrações externas no setup de testes;
- emissão externa agora exige `N8N_ENABLED=true`, URL configurada e ambiente diferente de teste;
- adicionado teste que garante que o ambiente de testes nunca chama webhook externo;
- separados comandos de teste para CRM, Mapa, reservas e UI;
- criado gate `test:gate:crm` com typecheck + suíte CRM;
- zip local incluído no `.gitignore`.

## Banco isolado para testes CRM

O comando `npm run test:crm` agora é executado por
`scripts/crm/testing/run-crm-tests.mjs`.

O executor:

- cria um diretório exclusivo com `mkdtemp` no diretório temporário do sistema;
- força `DATABASE_URL` para um SQLite novo dentro desse diretório;
- remove tokens e URLs de integrações externas do processo filho;
- aplica `prisma db push` no banco temporário;
- executa somente os alvos da suíte CRM;
- remove o diretório e o banco temporários mesmo quando a suíte falha.

Validação em 2026-07-28:

- datasource exibido pelo Prisma:
  `file:/tmp/delplata-crm-tests-…/crm-test.db`;
- 20 arquivos e 58 testes aprovados;
- nenhum arquivo de banco temporário permaneceu após a execução;
- `dev.db` e Turso não são usados por esse comando.

Os logs `P2002` da entrega concorrente e um evento tardio durante cleanup continuam
visíveis. Eles estão confinados ao banco efêmero e serão tratados ao substituir o
webhook Evolution pelo webhook idempotente da Meta.

## Gates de CI

O workflow `.github/workflows/quality-gates.yml` separa os gates em máquinas
independentes:

- TypeScript;
- CRM;
- Mapa e disponibilidade;
- reservas e pagamentos;
- interface.

O workflow usa Node 22, `npm ci`, geração do Prisma, permissões somente de leitura
e cancelamento de execuções antigas da mesma branch. Integrações externas ficam
desabilitadas por variáveis do próprio job.

Validação local antes da publicação:

- CRM: 20 arquivos e 58 testes aprovados com SQLite efêmero;
- Mapa: 7 arquivos e 53 testes aprovados;
- reservas: 15 arquivos e 91 testes aprovados;
- UI: 8 arquivos e 36 testes aprovados;
- TypeScript: aprovado.

Uma execução simultânea das três suítes no mesmo WSL gerou timeout intermitente em
um teste visual do Mapa. O mesmo teste e o gate completo passaram quando executados
isoladamente, como ocorrerá nos jobs independentes do GitHub Actions.

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

- [x] Executar o gate CRM três vezes e registrar duração/estabilidade.
- [x] Confirmar que nenhum processo do gate CRM excede o orçamento de cinco minutos.
- [x] Definir banco efêmero por execução para testes CRM que usam Prisma real.
- [x] Auditar bancos versionados sem publicar seus dados e remover o backup legado da branch.
- [x] Criar CI com os gates separados.
- [x] Registrar procedimento de rollback local e de produção.
