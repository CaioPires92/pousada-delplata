# Runbook de rollback do CRM

## Objetivo

Restaurar o atendimento e preservar mensagens, reservas e pagamentos quando uma
entrega do CRM apresentar regressão.

Este documento descreve procedimentos. Nenhum comando deve ser executado sem
confirmar ambiente, branch, commit e banco-alvo.

## Regras obrigatórias

- interromper rollout antes de tentar corrigir em produção;
- preservar evidências, logs e IDs de mensagens;
- nunca usar `git reset --hard` em workspace com alterações;
- preferir `git revert` ou um novo commit corretivo;
- nunca executar down migration improvisada em produção;
- fazer backup lógico antes de qualquer correção de banco;
- não permitir Evolution e Meta consumindo simultaneamente o mesmo número;
- não reenviar jobs ou mensagens sem idempotência confirmada.

## Critérios para acionar rollback

- mensagens duplicadas ou enviadas ao contato errado;
- perda de mensagens recebidas;
- webhook com aumento persistente de respostas `5xx`;
- fila crescendo sem processamento;
- preço ou disponibilidade divergentes do Mapa;
- automação respondendo após tomada humana;
- exposição de token ou PII;
- aumento de erros de reserva ou pagamento relacionado à entrega.

## 1. Rollback local

1. Registrar branch e commit:

   ```bash
   git status --short --branch
   git rev-parse HEAD
   ```

2. Preservar alterações não commitadas em uma branch própria ou commit de
   segurança. Não descartar arquivos do usuário.
3. Criar uma branch a partir do último commit conhecido como estável.
4. Instalar dependências e regenerar Prisma.
5. Executar os gates afetados antes de qualquer publicação:

   ```bash
   npm run typecheck
   npm run test:crm
   npm run test:mapa
   npm run test:reservas
   npm run test:ui
   ```

## 2. Rollback no GitHub

Para mudança já incorporada:

1. identificar o PR e o commit introdutor;
2. criar uma branch de rollback a partir da `main` atual;
3. usar `git revert <commit>` ou reverter o merge pelo GitHub;
4. abrir PR com descrição do incidente e impacto;
5. exigir os mesmos gates da entrega original;
6. não apagar a branch ou reescrever a `main`.

Se a mudança ainda estiver apenas em uma branch de trabalho, basta interromper o
merge. Nenhuma ação na `main` é necessária.

## 3. Rollback na Vercel

1. confirmar projeto `pousada-delplata` e ambiente `production`;
2. identificar o deployment estável anterior pelo commit SHA;
3. promover/reimplantar o deployment estável pela Vercel;
4. confirmar que o domínio oficial aponta para o deployment correto;
5. validar homepage, disponibilidade, admin, reservas e webhooks;
6. acompanhar erros de runtime antes de encerrar o incidente.

Reverter o deployment não reverte schema ou dados do banco.

## 4. Banco Turso

Antes de migration ou correção:

```bash
node scripts/reservas/db/backup-turso-logical.js --output=/caminho/seguro/backup.sql
```

Procedimento:

1. confirmar que `DATABASE_URL` aponta para Turso, nunca para `dev.db`;
2. gerar backup lógico fora do repositório;
3. registrar tamanho, horário e banco-alvo sem registrar tokens;
4. aplicar apenas migrations aditivas e idempotentes;
5. validar schema e consultas críticas;
6. em regressão, preferir forward-fix compatível com a versão anterior.

Restauração integral exige janela de manutenção e confirmação explícita, pois
pode substituir dados criados depois do backup.

## 5. Migração Evolution → Meta

Enquanto Evolution for o provedor estável:

- Meta deve permanecer em homologação ou canário;
- o mesmo número não pode ser consumido pelos dois provedores;
- a troca deve ocorrer por `WHATSAPP_PROVIDER`;
- tokens permanecem apenas no servidor.

Kill switch planejado:

```text
WHATSAPP_PROVIDER=evolution
```

O kill switch só é válido enquanto Evolution, credenciais e infraestrutura de
rollback estiverem preservadas e testadas.

Ordem do rollback de canal:

1. pausar novos envios automáticos;
2. impedir novos jobs de saída pela Meta;
3. aguardar ou classificar jobs em processamento;
4. trocar o provedor;
5. confirmar webhook ativo em apenas um provedor;
6. testar uma mensagem recebida e uma enviada;
7. liberar automação gradualmente;
8. replay somente de jobs idempotentes.

## 6. Verificação pós-rollback

- uma mensagem recebida gera uma única `Message`;
- uma mensagem enviada possui um único ID externo;
- atendimento humano continua pausando o bot;
- Inbox e Kanban exibem o mesmo contato/conversa;
- CRM e site retornam a mesma cotação;
- nenhuma reserva ou pagamento foi duplicado;
- filas e dead-letter estão estáveis;
- logs não mostram tokens, payloads sensíveis ou PII desnecessária.

## Registro mínimo do incidente

- início e fim;
- responsável;
- branch, commit e deployment;
- motivo do rollback;
- banco e backup utilizados;
- mensagens/jobs afetados;
- validações executadas;
- decisão sobre replay;
- ação preventiva criada.
