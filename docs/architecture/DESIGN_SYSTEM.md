# Design System Básico

## Objetivo
Padronizar visual sem alterar layout funcional existente.

## Tokens globais atuais
Fonte: `src/app/globals.css`

- Cores de superficie: `--background`, `--card`, `--popover`
- Texto: `--foreground`, `--muted-foreground`
- Acao: `--primary`, `--secondary`, `--accent`
- Estado: `--destructive`, `--ring`, `--border`
- Raio: `--radius`

## Regras de uso

- Site público e painel administrativo devem reutilizar os mesmos tokens CSS.
- Novos componentes devem consumir classes utilitarias/Tailwind derivadas dos tokens.
- Evitar cores hardcoded em componentes novos; preferir variaveis de tema.
- Estados da interface devem usar semântica (sucesso/aviso/erro), não cor arbitrária.

## Estrutura recomendada

- Base UI compartilhada: `src/components/ui/*`
- Componentes de dominio reservas: `src/components/*` relacionados ao fluxo de reserva
- Componentes administrativos: `src/components/admin/*` e componentes dedicados em `src/app/admin/*`

## Checklist para novos PRs

- usa tokens globais;
- contraste minimo legivel;
- estados de loading/erro padronizados;
- sem duplicar componente base ja existente em `src/components/ui`.
