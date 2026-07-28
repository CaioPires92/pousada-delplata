# Fase 0 — Auditoria de artefatos sensíveis

**Data:** 2026-07-28

## Escopo

Inventário por nomes, metadados e estrutura, sem publicar valores de variáveis,
dados de hóspedes ou credenciais.

## Resultado

### Artefato versionado

`prisma/dev.db.bak` era o único banco ou backup rastreado pelo Git.

- formato: SQLite;
- tamanho aproximado: 588 KiB;
- primeiro commit conhecido: `2904431`;
- não possuía referência no runtime, scripts ou documentação operacional;
- continha tabelas de hóspedes, contatos, mensagens, reservas e usuários
  administrativos;
- foi removido da branch de continuação com `git rm`;
- `*.bak` foi incluído no `.gitignore`.

A remoção atual não apaga o arquivo do histórico Git. Qualquer decisão de
reescrever o histórico remoto deve ser planejada separadamente, pois altera SHAs
e exige coordenação com todos os clones.

### Artefatos locais ignorados

Foram encontrados, sem leitura ou registro de valores:

- `.env`;
- `.env.backup`;
- `.env.production`;
- `.env.production.local`;
- `.env.swp`;
- `dev.db`;
- `prisma/dev.db`;
- `prisma/tmp-migrate.db`;
- `delplata-arquivos.zip`.

Todos estão cobertos pelas regras atuais do `.gitignore`. Os arquivos `.env`
locais incluem nomes de variáveis de banco, autenticação administrativa, SMTP,
Mercado Pago, Hospedin, Evolution, n8n, analytics e Vercel.

## Avaliação de risco

- Não foram encontrados arquivos `.env` rastreados no estado ou histórico
  consultado.
- O backup SQLite versionado deve ser tratado como potencial exposição de PII,
  mesmo sem inspeção de registros.
- `.env.production.local` foi criado por exportação da Vercel e contém nomes de
  credenciais de produção; deve permanecer apenas pelo tempo necessário.
- `.env.backup` e `.env.swp` ampliam a quantidade de cópias locais de segredos e
  devem ser removidos manualmente depois que o responsável confirmar que não são
  necessários.

## Ações que exigem autorização operacional

- confirmar e remover cópias locais antigas de `.env`;
- avaliar rotação de credenciais que possam ter coexistido com o backup;
- decidir se o histórico Git remoto deve ser reescrito para remover o SQLite;
- recriar uma `.env.example` sanitizada, contendo apenas nomes e placeholders;
- registrar a data e o responsável por cada rotação.

Nenhuma credencial foi rotacionada e nenhum arquivo `.env` foi removido nesta
microentrega.

## Modelo sanitizado

Uma nova `.env.example` rastreável foi criada apenas com:

- URLs locais;
- endereços e telefones fictícios;
- placeholders explícitos;
- chaves vazias;
- integrações externas desabilitadas por padrão;
- variáveis futuras da Meta vazias e provedor inicial definido como Evolution.

O `.gitignore` continua bloqueando todos os demais `.env*` e abre exceção somente
para `.env.example`.
