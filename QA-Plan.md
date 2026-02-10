# Plano de Patch e Guardrails de QA

## Objetivo
- Consolidar correções recentes de lint/typecheck e estabilidade de APIs.
- Estabelecer guardrails para garantir qualidade: testes obrigatórios antes de avançar.
- Documentar passos para aumentar cobertura e validar build fora do OneDrive.

## Branch
- Nome: `novas`
- Status: criada a partir de `main`.

## Guardrails (Regra Obrigatória)
- Antes de qualquer nova funcionalidade:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - Para mudanças maiores: `npm run test:coverage`
- Só avançar se testes passarem (sem falhas).
- Build: evitar rodar `next build` em diretórios OneDrive (usar diretório não-sincronizado ou CI).
- Segredos: nunca commitar `.env` ou logar tokens.

## Passos do Patch (Incremental)
1. Aumentar cobertura em `app/api/bookings/route.ts`
   - Adicionar testes para:
     - Sem disponibilidade (inventário esgotado).
     - Múltiplas noites com taxas extras.
     - TTL de `PENDING` afetando sobreposição.
   - Rodar testes e cobertura.
2. Cobrir utilitários `lib/day-key.ts`
   - Testar `prevDayKey`, `compareDayKey`, intervalos cruzando mês/ano.
   - Rodar testes e cobertura.
3. Cobrir `components/SearchWidget.tsx`
   - Testes de UI (Testing Library): popovers, validação de idades, anti-bfcache, navegação.
   - Rodar testes e cobertura.
4. Validar build em ambiente adequado
   - Clonar projeto fora do OneDrive ou usar CI.
   - Rodar `npm run build`.

## Critérios de Aceite
- Todos os testes passam.
- Cobertura global ≥ 75% (meta inicial).
- Sem segredos em commits.

## Comandos de Verificação
```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
```

## Referências
- Correções de hooks com `useCallback` nas páginas admin.
- Limpeza de imports/variáveis não usados nas rotas e componentes.
