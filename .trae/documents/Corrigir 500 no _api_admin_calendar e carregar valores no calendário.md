## Causa raiz provável (por que está dando 500)
- O endpoint [calendar/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/admin/calendar/route.ts) hoje espera `startDate/endDate` como `YYYY-MM-DD` e o modelo `Rate/InventoryAdjustment` como `String` no Prisma.
- Se o servidor estiver rodando com **Prisma Client/DB ainda no schema antigo (DateTime)**, o Prisma tende a lançar `PrismaClientValidationError` ao fazer filtros e/ou ao ler/formatar, resultando em **500**.
- Isso é compatível com o seu cenário: a URL que você passou usa `startDate=2026-01-01&endDate=2026-01-31` (day key), mas um Prisma “DateTime” frequentemente exige RFC3339 completo (ou Date), e a query quebra.

## Diagnóstico (o que vou checar primeiro)
1. Confirmar no log do servidor qual erro está sendo lançado (tipicamente `PrismaClientValidationError` ou erro do `$queryRaw`).
2. Validar se o Prisma Client foi regenerado e se o banco já recebeu o schema atualizado (DateTime → String).
3. Validar se o frontend está chamando o endpoint com `YYYY-MM-DD` (em vez de `toISOString()`), e se trata `res.ok` corretamente.

## Correções planejadas
### 1) Backend: deixar o erro explícito e corrigir o runtime
- Em [calendar/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/admin/calendar/route.ts):
  - Logar `name/message/stack` do erro e, em dev, devolver um JSON com `message` e `details` (sem vazar secrets).
  - Definir `export const runtime = 'nodejs'` para evitar qualquer chance de execução em edge (Prisma não suporta edge).

### 2) Prisma: alinhar Client + DB ao schema novo
- Aplicar schema no banco local e regenerar o client:
  - `npx prisma db push`
  - `npx prisma generate`
  - reiniciar o `npm run dev`
- Isso elimina o 500 que vem de incompatibilidade de tipos/colunas.

### 3) Frontend: corrigir `fetchRates` e `useEffect` (carregamento + erros)
- Em [page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/admin/mapa/page.tsx):
  - `fetchRates`: checar `res.ok` antes de `res.json()`, e se falhar exibir mensagem amigável + log completo.
  - Adicionar estado de erro (`calendarError`) e estado de loading do calendário, para UX consistente.
  - Garantir que o `useEffect` rode também quando `currentDate` muda (hoje ele depende de `fetchRates`, mas vamos garantir que não há race ao mudar `selectedRoomId`).

## Validação (como vou garantir que resolveu)
- Requisitar exatamente:
  - `/api/admin/calendar?roomTypeId=...&startDate=2026-01-01&endDate=2026-01-31&_t=...`
- Confirmar:
  - Status 200
  - JSON array com `date` em `YYYY-MM-DD` e valores (`price/stopSell/...`) preenchidos.
- No UI:
  - Abrir Mapa de Tarifas, trocar acomodação/mês, e verificar que o calendário popula sem erro.

Se você confirmar este plano, eu aplico as mudanças no backend (logs + runtime), ajusto `fetchRates/useEffect` com tratamento de erro e rodo o alinhamento do Prisma (db push/generate) para eliminar o 500.