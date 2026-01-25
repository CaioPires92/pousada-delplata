O diagnóstico aponta para problemas de **fuso horário e consistência de datas** entre o Frontend e o Backend, o que impede a atualização correta do inventário (quartos), além de melhorias necessárias na UI para feedback em tempo real.

### 1. Correção de Sincronização de Dados (Backend)
O problema "Não é possível modificar a quantidade de quartos" ocorre porque o servidor e o banco de dados podem estar interpretando as datas de forma diferente (UTC vs Local), fazendo com que o ajuste salvo não seja encontrado na leitura.
- **Ação**: Padronizar a lógica de datas nas APIs `/api/admin/inventory` e `/api/admin/calendar`.
- **Implementação**: Usar strings `yyyy-MM-dd` explicitamente para comparação e persistência, garantindo que o dia salvo seja exatamente o dia lido, independente do horário.

### 2. Feedback em Tempo Real e UI (Frontend)
Para resolver a sensação de "dados não atualizados" e "inoperante":
- **Ação**: Adicionar estados de carregamento (loading spinners/opacity) nos botões de incremento/decremento de quartos e no salvamento de tarifas.
- **Implementação**: Bloquear a UI enquanto a requisição acontece e forçar uma atualização visual imediata (atualização otimista) ou garantir o recarregamento rápido dos dados.

### 3. Validação e Consistência
- **Ação**: Revisar o mapeamento de campos na API de calendário para garantir que `totalInventory` e `available` estejam 100% alinhados com o banco.
- **Implementação**: Reforçar a query do Prisma para garantir que traga os dados mais recentes (já iniciado com o `orderBy` adicionado anteriormente).

Este plano ataca a raiz técnica dos problemas relatados (datas e feedback de UI). Posso prosseguir com essas correções?