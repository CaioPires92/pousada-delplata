# Implementar Funcionalidade de Edição em Lote de Quartos

## 1. Backend: Atualizar API de Quartos
- Modificar `web/src/app/api/admin/rooms/route.ts` para adicionar o método `PATCH`.
- A nova rota aceitará um corpo JSON com:
  - `roomTypeId`: ID do tipo de quarto ou string `'all'`.
  - `totalUnits`: Novo número de unidades disponíveis (inteiro >= 0).
- **Lógica de Atualização:**
  - Se `roomTypeId === 'all'`, atualizará o campo `totalUnits` de **todos** os registros `RoomType` no banco de dados.
  - Se for um ID específico, atualizará apenas aquele registro.
- **Validação:** Garantir que `totalUnits` não seja negativo.

## 2. Frontend: Interface de Administração de Quartos
- Atualizar `web/src/app/admin/quartos/page.tsx`:
  - Adicionar um botão **"Edição em Lote"** no cabeçalho da página (ao lado do título "Gerenciar Quartos").
  - Criar um novo modal específico para a edição em lote.
  - **Campos do Modal:**
    - **Tipo de Quarto:** Select contendo a opção "Todos" e a lista de quartos existentes.
    - **Quantidade Disponível:** Input numérico para definir o novo valor de `totalUnits`.
  - Implementar a função `handleBatchSave` para enviar os dados para a nova rota `PATCH`.
  - Atualizar a lista de quartos após o salvamento bem-sucedido.

## 3. Estilos
- Atualizar `web/src/app/admin/quartos/quartos.module.css` se necessário para estilizar o novo botão e garantir que o modal de lote siga o mesmo padrão visual do modal de edição individual.
