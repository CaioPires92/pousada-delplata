## Diagnóstico (causa raiz)
- O dropdown do Mapa e a tela de Quartos usam APIs que retornam **todos** os `RoomType` do banco.
  - Public: [rooms/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/rooms/route.ts)
  - Admin: [admin/rooms/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/admin/rooms/route.ts)
- Não existe filtro que esconda “Apartamento Anexo”. Logo, a causa mais provável é **dados**: o registro do room type “Apartamento Anexo” não está presente no banco (Turso/SQLite usado no ambiente atual).
- O projeto não tem fluxo de criação de room type no painel (só edição), então se ele não foi inserido via seed/DB, ele nunca aparece.

## O que vou implementar
### 1) Backend: criar endpoint para cadastrar novo RoomType
- Adicionar `POST /api/admin/rooms` para criar um novo tipo de quarto (name/description/capacity/totalUnits/basePrice/amenities + photos).
- Validar payload e retornar o objeto criado.

### 2) Frontend (Admin > Quartos): adicionar UI “Adicionar Quarto”
- Em [quartos/page.tsx](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/admin/quartos/page.tsx):
  - Botão “➕ Adicionar Quarto”.
  - Modal com formulário (campos mínimos) e submit chamando `POST /api/admin/rooms`.
  - Recarregar a lista após criar.

### 3) Confirmação automática no Mapa
- Como o Mapa carrega opções via [rooms/route.ts](file:///c:/Users/caiog/OneDrive/%C3%81rea%20de%20Trabalho/trae/Delplata-Motor/web/src/app/api/rooms/route.ts), ao criar o quarto no painel ele passa a aparecer automaticamente no dropdown.

## Validação
- Criar “Apartamento Anexo” em Admin > Quartos.
- Confirmar que ele aparece:
  - na listagem de Quartos
  - no dropdown do Mapa de Tarifas
  - e no endpoint `/api/rooms`.
- Rodar lint/test para garantir que nada quebrou.

## Observação (produção vs dev)
- Se você estiver em produção (Turso), esse fluxo resolve sem depender de seed.
- Se for dev local, também funciona, e evita ter que apagar e reseedar o banco.