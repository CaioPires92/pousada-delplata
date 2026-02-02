## Contexto do código (onde mexer)
- Cálculo de preço atual por noite/diária: [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/availability/route.ts)
- Criação de booking hoje confia em `totalPrice` vindo do frontend: [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/bookings/route.ts)
- UI de busca (adultos/crianças) usada no fluxo público: [SearchWidget.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/components/SearchWidget.tsx)
- Página pública de “reservar” que consome disponibilidade e cria booking: [page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/reservar/page.tsx)
- Admin calendário continua definindo apenas preço da diária (rate/basePrice): [route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/admin/calendar/route.ts)

## Modelo de dados (Prisma + migração)
- Atualizar `RoomType` para suportar extras:
  - `extraAdultFee` (Decimal, default 0)
  - `child6To11Fee` (Decimal, default 0)
  - `includedAdults` (Int, default 2) (opcional, mas recomendo para deixar explícito)
  - `maxGuests` (Int, default 3) (opcional, mas recomendo para validar por quarto)
- Ajustar script de migração Turso (se necessário) para `ALTER TABLE RoomType ADD COLUMN ...` com defaults.

## Função centralizada de preço (backend)
- Criar uma função única `calculateBookingPrice(...)` em `src/lib` que:
  - Recebe `nights`, `baseTotalForStay` (somatório das diárias/rates do período), `adults`, `childrenAges`, `extraAdultFee`, `child6To11Fee`, `includedAdults`, `maxGuests`
  - Converte `childrenAges >= 12` em adultos efetivos
  - Cobra `child6To11Fee` por noite para idades 6–11
  - Valida:
    - mínimo 1 adulto (após conversão)
    - capacidade: `effectiveAdults + childrenUnder12 <= maxGuests` (max 3)
  - Calcula:
    - `extraAdultsCount = max(0, effectiveAdults - includedAdults)`
    - `extrasPerNight = extraAdultsCount*extraAdultFee + child6To11Count*child6To11Fee`
    - `total = baseTotalForStay + extrasPerNight*nights`
  - Retorna breakdown detalhado: `baseTotal`, `nights`, `effectiveAdults`, `childrenUnder12`, `extraAdultsCount`, `child6To11Count`, `extrasPerNight`, `extraAdultTotal`, `childTotal`, `total`

## Backend: usar a função em disponibilidade e booking
- Disponibilidade (`/api/availability`):
  - Ler `childrenAges` de query (ex: `childrenAges=6,10`) e validar coerência com `children`.
  - Continuar somando o preço base por noite (rate ou basePrice) exatamente como hoje.
  - Aplicar `calculateBookingPrice` usando `baseTotalForStay` e fees do `RoomType`.
  - Retornar `totalPrice` já com extras + um `breakdown` para o front mostrar.
  - Validar capacidade sempre no backend (se exceder, retornar 400 com erro específico de capacidade).
- Booking (`/api/bookings`):
  - Expandir payload para receber `adults` e `childrenAges` (ou inferir de query/estado), mantendo datas/quarto/guest.
  - Ignorar `totalPrice` vindo do cliente (ou apenas usar como referência) e recalcular server-side:
    - Calcular `baseTotalForStay` com a mesma regra de rates/basePrice para as noites
    - Aplicar `calculateBookingPrice`
  - Persistir `booking.totalPrice` com o valor calculado.

## Frontend: coletar idades e exibir breakdown
- `SearchWidget`:
  - Quando `children > 0`, renderizar inputs simples de idade (1 input por criança).
  - Manter `childrenAges: number[]` no estado; ao mudar quantidade de crianças, ajustar tamanho do array.
  - Antes do submit, validar que todas idades foram preenchidas (0–17) e anexar no URL (`childrenAges=...`).
- `reservar/page.tsx`:
  - Ler `childrenAges` de `useSearchParams`.
  - Passar `childrenAges` para chamada de `/api/availability`.
  - No resumo da reserva, exibir breakdown (Base + extras + Total) sem alterar layout além do necessário.
  - No `POST /api/bookings`, enviar `adults` e `childrenAges` para validação final no backend.

## Testes
- Criar testes unitários para `calculateBookingPrice` cobrindo:
  - 2 adultos (sem extra)
  - 3 adultos (extraAdultFee por noite)
  - criança 6–11 (child fee)
  - criança 12+ conta como adulto
  - validações (adultos mínimos, capacidade)
- Ajustar testes existentes de availability para considerar o breakdown/total novo quando fees > 0.

## Verificação (antes do merge)
- Rodar `npm run typecheck`, `npm run lint`, `npm run test` no diretório `web/`.
- Testar manualmente fluxo:
  - 2 adultos
  - 2 adultos + criança 10
  - 2 adultos + criança 12 (vira 3 adultos)
  - 1 adulto + 2 crianças (ex: 5 e 8)

Se confirmar este plano, eu começo a implementação (schema + cálculo + UI + testes) seguindo os guardrails.