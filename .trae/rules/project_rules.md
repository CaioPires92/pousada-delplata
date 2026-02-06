[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase

---

## Guardrails de Qualidade (QA)

- Antes de iniciar qualquer nova funcionalidade:
  - Executar: `npm run lint` e `npm run typecheck`.
  - Executar suíte de testes: `npm run test`.
  - Para mudanças significativas, gerar cobertura: `npm run test:coverage`.
- Somente avançar para a próxima tarefa se todos os testes passarem.
- Evitar `next build` em diretórios sincronizados pelo OneDrive (Windows); executar build em diretório não-sincronizado ou em CI.
- Nunca logar segredos/tokens; .env não deve ser commitado.
- Padronizar fetchers React com `useCallback` e efeitos dependentes do callback (evita `react-hooks/exhaustive-deps`).
