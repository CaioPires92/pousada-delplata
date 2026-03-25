# PR: FASE 2 - Refactor UI/UX Admin > Reservas

## Objetivo
Refatorar a página `Admin > Reservas` para melhorar legibilidade e navegação, sem alterar regras de negócio do motor (status, pagamentos, webhook, inventário).

## Escopo aplicado
- Refactor visual de `src/app/admin/reservas/page.tsx` e `src/app/admin/reservas/reservas.module.css`.
- Lista em formato row-card responsivo (substitui tabela densa).
- Header sticky com:
  - título e contador;
  - tabs de status;
  - filtro de período (mês/semana/dia/intervalo);
  - toggle client-side de `Modo teste (analytics)` com persistência em `localStorage`.
- Nota discreta de test payments (`NEXT_PUBLIC_ENABLE_TEST_PAYMENTS`) separada do toggle de analytics.
- Remoção do banner fixo de modo teste.
- Filtro server-side no `GET /api/admin/bookings` com query params opcionais e fallback seguro:
  - `dateFrom`, `dateTo`, `dateField`, `status`, `limit`, `cursor`.
- Mantida compatibilidade: sem params => comportamento atual.

## Arquivos alterados
- `src/app/admin/reservas/page.tsx`
- `src/app/admin/reservas/reservas.module.css`
- `src/app/admin/reservas/booking-row-card.tsx`
- `src/app/admin/reservas/booking-view.ts`
- `src/app/admin/reservas/period.ts`
- `src/app/admin/reservas/types.ts`
- `src/app/api/admin/bookings/route.ts`
- `src/app/admin/reservas/booking-row-card.test.tsx`
- `src/app/admin/reservas/period.test.ts`

## Testes adicionados
- `booking-row-card.test.tsx`
  - render de card com dados completos;
  - fallback de `checkIn` ausente para `createdAt`.
- `period.test.ts`
  - query params do filtro mensal;
  - fallback sem filtro de data para intervalo inválido.

## Execução de testes
- `npm run test -- src/app/admin/reservas/booking-row-card.test.tsx src/app/admin/reservas/period.test.ts` ✅
- `npm run typecheck` ⚠️ falha por erro pré-existente em `src/app/api/admin/bookings/[bookingId]/approve-test/route.test.ts` (`Request` vs `NextRequest`), fora do escopo desta PR.

## Checklist manual (smoke)
- [ ] Status tabs continuam funcionando.
- [ ] Período mês/semana/dia/intervalo altera a listagem.
- [ ] Sem erros no console.
- [ ] Dropdown/ações funcionam em desktop e mobile (ellipsis no mobile).
- [ ] Toggle "Modo teste (analytics)" persiste após recarregar.
- [ ] Com `NEXT_PUBLIC_ENABLE_TEST_PAYMENTS=true`, aparece nota "Test payments habilitado".
- [ ] Sem regressão visual no scroll vertical (evitar nested scroll).

## Guardrails confirmados
- [x] Sem mudança de schema.
- [x] Sem alteração de endpoint de pagamento/webhook/approve-test além da UI cliente de Reservas.
- [x] Sem alteração de lógica de inventário/disponibilidade do motor.
