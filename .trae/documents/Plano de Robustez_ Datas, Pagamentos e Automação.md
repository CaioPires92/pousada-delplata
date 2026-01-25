Aqui está o plano de ação completo para blindar o sistema, focando primeiro na eliminação definitiva dos bugs de data.

## Fase 1: Padronização e Segurança de Datas (Imediato)
**Objetivo:** Criar uma "única fonte da verdade" para manipulação de datas, eliminando lógica manual (`split`, `setUTCHours`) espalhada pelo código que causa erros de fuso horário.

1.  **Criar `src/lib/date-utils.ts`**:
    -   Implementar `parseLocalDate(string)`: Converte "YYYY-MM-DD" para Date seguro (meia-noite local).
    -   Implementar `toISODateString(date)`: Extrai "YYYY-MM-DD" de forma consistente ignorando timezones.
2.  **Refatorar APIs Críticas**:
    -   `/api/availability`: Substituir o parsing manual pelo `parseLocalDate`.
    -   `/api/admin/inventory`: Substituir a normalização manual (`setUTCHours`) pelo utilitário.
    -   `/api/admin/calendar`: Padronizar a geração de chaves de data.
3.  **Validar**: Rodar a suíte de testes existente para garantir que nada quebrou.

## Fase 2: Confiabilidade Financeira (Próximo)
**Objetivo:** Garantir que o fluxo de reserva e geração de pagamento nunca falhe silenciosamente.

1.  **Mock do MercadoPago**: Criar um simulador para a API de pagamentos nos testes.
2.  **Teste de Integração (`booking.test.ts`)**:
    -   Simular um cliente criando uma reserva.
    -   Verificar se a reserva é salva no banco como "PENDING".
    -   Verificar se a preferência de pagamento é gerada.

## Fase 3: Automação (CI/CD)
**Objetivo:** Impedir que código quebrado entre no repositório.

1.  **Configurar GitHub Actions**: Criar workflow que instala, bida e testa o projeto a cada push.

---

**Vou iniciar imediatamente a FASE 1 (Padronização de Datas) assim que você confirmar.**