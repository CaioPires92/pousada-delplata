## Contexto Atual (evidência no código)
- O payload do frontend é montado em [page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/admin/mapa/page.tsx) dentro de `handleBulkSave` e enviado via `fetch('/api/rates/bulk', { body: JSON.stringify(payload) })`.
- O handler do endpoint está em [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/rates/bulk/route.ts). Hoje ele usa `prisma.$transaction(async (tx) => { ... }, { maxWait, timeout })`, que é transação interativa.

## Hipóteses que serão validadas por stack trace (sem suposições)
- **Falha antes de entrar no loop**: erro do Prisma/adapter ao iniciar transação interativa com LibSQL/Turso.
- **Falha em query específica**: erro do Prisma ao executar `findMany/deleteMany/create` em `rate` ou ao manipular datas.
- **Falha em constraint**: violação de `@@unique([roomTypeId, date])` em `InventoryAdjustment` ou inconsistência na resolução de chave composta.

## Passo 1 — Instrumentação obrigatória de logs (frontend)
- Manter/confirmar o log temporário já inserido antes do `fetch` (mostra `payload` completo).
- Garantir que o log inclua o payload exatamente como enviado.

## Passo 2 — Instrumentação obrigatória de logs (backend)
- No início do handler, logar o corpo bruto recebido (`req.body`) com `console.log`.
- No `catch` do handler, adicionar:
  - `console.error('[Bulk Update] ERROR', err)`
  - `console.error('[Bulk Update] STACK', err?.stack)`
  - Retorno JSON em erro:
    - Sempre: `{ error: 'BulkUpdateFailed', message }`
    - Em development: incluir `stack` e um `details` com tipo/causa (ex.: `PrismaClientKnownRequestError`, `code`).
  - Mapear erros para status:
    - 400: payload inválido (datas, tipos, inventory)
    - 409: violação de constraint/unique
    - 500: erro inesperado

## Passo 3 — Executar a requisição e coletar evidência
- Subir o servidor local.
- Executar a requisição com o payload real:
  - `{"roomTypeId":"all","startDate":"2026-01-27","endDate":"2026-02-07","updates":{"price":599,"inventory":2}}`
- Capturar e colar aqui:
  - Stack trace completo do terminal
  - Linha exata (arquivo:linha) que lançou a exceção

## Passo 4 — Corrigir causa raiz (após evidência)
- Se o stack indicar **transação interativa não suportada** (adapter LibSQL):
  - Refatorar o endpoint para **não usar** `prisma.$transaction(async (tx)=>...)`.
  - Migrar para transação em lote `prisma.$transaction([op1, op2, ...])` mantendo atomicidade.
- Se o stack indicar **problema com chave composta/unique**:
  - Voltar a usar operações consistentes com o schema:
    - `upsert({ where: { roomTypeId_date: { roomTypeId, date } }, ... })` quando aplicável
  - Garantir que o `date` usado na chave composta seja consistente (normalização de horário).
- Se o stack indicar **violação de constraint**:
  - Retornar 409 com mensagem clara e `code` do Prisma.

## Passo 5 — Prova de correção
- Reexecutar a mesma requisição.
- Mostrar aqui:
  - Exemplo de resposta **200** `{ success: true, affectedRooms: N, affectedDays: M }`
  - Exemplo de resposta **400/409** com `{ error, message, details }`

Quando você confirmar, eu aplico a instrumentação final no `catch`, executo a requisição localmente e trago o stack trace + patch definitivo do backend.