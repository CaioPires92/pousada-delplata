## Causa raiz (regressões)
### Problema 1 — Thumbnails
- O backend **já retorna fotos** na disponibilidade: o endpoint [availability/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/availability/route.ts) inclui `photos: true`.
- A regressão está no frontend da listagem de acomodações: [acomodacoes/page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/acomodacoes/page.tsx) aplica um fallback `localCoverFor(...)` quando a URL da foto **não começa com `/fotos`**:
  - `const coverUrl = (room.photos[0]?.url?.startsWith('/fotos') && ...) || localCoverFor(room.name);`
  - Se as fotos do banco estão em URL absoluta (https://...) ou outro path, esse `startsWith('/fotos')` falha e cai nas “imagens genéricas”.

### Problema 2 — Datepicker
- O datepicker é o `react-day-picker` estilizado via [ui/calendar.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/components/ui/calendar.tsx).
- As linhas (`head_row`/`row`) estão como `flex` sem `justify-between`, então as 7 células fixas ficam “grudadas à esquerda” deixando espaço à direita.

## Patch mínimo (sem mexer em disponibilidade, dashboard, queries)
### 1) Thumbnails: usar somente imagem do backend + placeholder neutro
Arquivos: [RoomCard.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/components/RoomCard.tsx), [acomodacoes/page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/acomodacoes/page.tsx)
- Remover completamente o fallback `localCoverFor(...)`.
- Fazer o card **sempre** tentar `room.photos[0]?.url`.
- Se não existir foto:
  - renderizar um placeholder neutro (div cinza com “Sem foto” — sem imagem genérica)
  - `console.warn` no client com `room.id`/`room.name`.
- Garantir que não exista fallback silencioso para imagens genéricas quando há foto no banco.

### 2) Datepicker: restaurar 7 colunas alinhadas
Arquivo: [ui/calendar.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/components/ui/calendar.tsx)
- Ajustar `classNames.head_row` e `classNames.row` para `flex ... justify-between`.
- Manter o resto intacto (sem mexer em CSS global/resets).

## Validação (checklist do pedido)
- Cards exibem thumbnails reais do banco (quando `photos[0].url` existe).
- Nenhuma imagem genérica aparece quando há thumbnail cadastrada.
- Quando não há foto: placeholder neutro + warning no console.
- Datepicker com dias em 7 colunas alinhadas.
- “Apto Anexo” continua aparecendo (não toca em lógica de disponibilidade nem dashboard).

Se ok, eu aplico as mudanças somente nesses 3 arquivos e rodo lint/test.