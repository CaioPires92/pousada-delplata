# Instruções para agentes (Pousada Delplata)

## Pendências (lembrete obrigatório)
A cada pedido de atualização, correção ou nova funcionalidade, leia `PENDENCIAS.md` antes de começar e lembre o usuário, em poucas linhas no início da resposta, das pendências abertas (principalmente as que vencem ou bloqueiam algo). Se o trabalho resolver ou criar uma pendência, atualize o arquivo no mesmo commit. Não marque nada como concluído sem evidência.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
