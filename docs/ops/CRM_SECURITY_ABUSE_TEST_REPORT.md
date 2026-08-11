# Relatório de segurança e abuso do CRM

Data da execução: 11/08/2026

Comando reproduzível:

```bash
npm run test:crm:security
```

## Resultado

- 9 arquivos de teste aprovados.
- 47 cenários aprovados.
- Banco SQLite temporário e integrações externas desativadas durante a execução.
- Nenhuma credencial real é gravada no relatório ou usada pelo perfil.

## Controles exercitados

- Webhook Evolution: segredo ausente, incorreto e correto; instância incorreta; JSON malformado; limite de 256 KB; duplicidade concorrente.
- APIs internas: rejeição de token ausente/incorreto antes de executar efeitos colaterais.
- Dead-letter: replay exige autenticação e identificador válido.
- IA: schema estrito e allowlist rejeitam ação injetada no texto.
- Automação: limites de envio e opt-out impedem abuso de mensagens.
- Resiliência: circuit breaker impede chamadas repetidas durante falha do provider.
- Cupons: link assinado não aceita identificador ou assinatura adulterados.

## Gate

O perfil foi aprovado sem falhas. A rotação dos segredos reais permanece separada e
adiada para o encerramento da implementação, conforme decisão registrada no roadmap.
