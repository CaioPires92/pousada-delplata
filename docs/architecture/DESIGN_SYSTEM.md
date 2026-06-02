# Design System Basico (Site + CRM)

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

- Site publico e CRM devem reutilizar os mesmos tokens CSS.
- Novos componentes devem consumir classes utilitarias/Tailwind derivadas dos tokens.
- Evitar cores hardcoded em componentes novos; preferir variaveis de tema.
- Estados de pipeline/automacao devem usar semantica (sucesso/aviso/erro), nao cor arbitraria.

## Estrutura recomendada

- Base UI compartilhada: `src/components/ui/*`
- Componentes de dominio reservas: `src/components/*` relacionados ao fluxo de reserva
- Componentes de dominio CRM: `src/components/admin/*` e componentes dedicados em `src/app/admin/*`

## Checklist para novos PRs

- usa tokens globais;
- contraste minimo legivel;
- estados de loading/erro padronizados;
- sem duplicar componente base ja existente em `src/components/ui`.
