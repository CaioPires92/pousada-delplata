# Trash / Quarentena

Arquivos movidos para revisao manual, sem uso esperado em runtime:

- `for-review/banner-01-maio.pngZone.Identifier` (metadado do Windows)
- `for-review/db` (arquivo vazio)
- `for-review/db-wal` (arquivo vazio)
- `for-review/webhook_debug.log` (log operacional antigo)
- `for-review/webhook_debug.log.latest` (log operacional recente movido da raiz)
- `for-review/webhook_debug.log.root` (novo log recriado na raiz e movido para quarentena)
- `for-review/dev.db.root` (arquivo de banco SQLite solto na raiz)

Observacao:
- O webhook pode recriar `webhook_debug.log` automaticamente na raiz quando receber eventos.
