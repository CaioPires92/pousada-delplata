## Diagnóstico (estado atual)
- O projeto mistura “dia de calendário” (conceito sem timezone) com `Date`/UTC.
- Há pontos críticos que causam deslocamento (+1/−1) dependendo do timezone/runtime:
  - `new Date("YYYY-MM-DD")` (interpreta como UTC) e depois `setHours(...)`.
  - `toISOString()` para derivar o “dia”.
  - loops com `setDate(...)` em objetos `Date`.
- No fluxo de tarifas/estoque isso aparece principalmente em:
  - Backend: [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/rates/bulk/route.ts) (usa `new Date(startDate)`/`new Date(endDate)` e `parseLocalDate`).
  - Backend: [inventory/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/inventory/route.ts) (usa `new Date(date)` e range com `new Date(startDate)`/`new Date(endDate)`).
  - Frontend: [page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/admin/mapa/page.tsx) (busca calendário com `start.toISOString()`/`end.toISOString()`).
  - Utilitário: [date-utils.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/lib/date-utils.ts) (tem `toISODateString` com `toISOString()`).
- Além disso, o schema atual persiste datas de tarifas/estoque como `DateTime`, o que conflita diretamente com as regras: [schema.prisma](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/prisma/schema.prisma)
  - `Rate.startDate/endDate: DateTime`
  - `InventoryAdjustment.date: DateTime`

## Objetivo (modelo correto)
- “Dia” é sempre `string` no formato `YYYY-MM-DD` (sem timezone) do início ao fim.
- Frontend só usa `Date` para UI/exibição.
- Backend:
  - recebe `date: "YYYY-MM-DD"`
  - persiste `date` como string
  - nunca usa `toISOString()` para representar “dia”
  - não usa `new Date("YYYY-MM-DD")` nem `setDate(...)` no fluxo de tarifas.

## Plano de Implementação
### 1) Alterar o Schema (persistência como string)
- Trocar no Prisma:
  - `Rate.startDate/endDate` → `startDay/endDay: String` (mantém compressão por intervalos, mas sem `Date`).
  - `InventoryAdjustment.date` → `date: String` (ou `dateKey: String`) e manter `@@unique([roomTypeId, date])`.
- Criar migração compatível com SQLite (table rebuild) e, se necessário, script de conversão para dados existentes (extrair `YYYY-MM-DD` do DateTime armazenado).

### 2) Backend: refatorar endpoints para trabalhar só com strings
- `POST /api/rates/bulk`:
  - Parar de converter para `Date` (`parseISO`, `new Date(...)`, `parseLocalDate`, `setHours`).
  - Operar a faixa usando apenas strings `YYYY-MM-DD`.
  - Implementar helpers puros (sem `Date`) para:
    - validar formato `YYYY-MM-DD`
    - iterar dias (`nextDayKey`, `eachDayKeyInRange`)
    - detectar “consecutivo” (`nextDayKey(prev) === curr`).
  - Persistir `Rate` com `startDay`/`endDay` como strings.
- `POST /api/admin/inventory` (ou o endpoint equivalente usado no mapa):
  - Persistir/consultar por `date` string.
  - Remover `new Date(date)` e ranges com `new Date(...)`.
- `GET /api/admin/calendar`:
  - Receber `startDate/endDate` como `YYYY-MM-DD`.
  - Gerar lista de `date` strings no intervalo via helpers puros.
  - Buscar rates/estoque por comparações lexicográficas (`YYYY-MM-DD` ordena corretamente).
  - Montar a resposta com `date: dayKey` e campos numéricos/boolean.

### 3) Frontend: padronizar dayKey e payload
- Substituir qualquer uso de `toISOString()` para datas de calendário:
  - Em [page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/admin/mapa/page.tsx), trocar query do calendário para:
    - `startDate=format(start,'yyyy-MM-dd')`
    - `endDate=format(end,'yyyy-MM-dd')`
- No salvar 1 dia (preço/estoque/stopSell):
  - Gerar `dayKey = format(selectedDate, 'yyyy-MM-dd')`.
  - Enviar payload com `date: dayKey` e campos (sem `Date`, sem `startDate/endDate` e sem UTC).
  - Trocar keys do React de `day.toISOString()` para `format(day,'yyyy-MM-dd')` (remove `toISOString` do calendário inteiro).

### 4) Remover/substituir usos proibidos no fluxo
- Substituir/remover:
  - `toISODateString` (ou tornar frontend-only e sem `toISOString`).
  - `new Date('YYYY-MM-DD')` no backend de tarifas/estoque.
  - loops com `setDate(...)` no backend de tarifas/estoque.

### 5) Testes e Critério de Sucesso
- Testes unitários dos helpers de `YYYY-MM-DD` (incremento e range) sem `Date`.
- Teste de API:
  - envia `date: '2026-01-28'` e valida que o registro persistido/retornado mantém `2026-01-28`.
- Teste manual guiado:
  - selecionar 28/01/2026 → salvar → recarregar → dia 28 atualizado (não 29).

## Entregáveis
- Migração Prisma + ajustes de schema.
- Refatoração das rotas `rates/bulk`, `admin/calendar`, `admin/inventory` (e afins) para strings.
- Ajustes no frontend do Mapa de Tarifas para enviar `date` string e parar de usar UTC.
- Testes automatizados garantindo que 28 salva 28.