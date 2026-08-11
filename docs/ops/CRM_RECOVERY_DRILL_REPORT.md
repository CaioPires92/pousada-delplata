# Ensaio de recuperação do CRM

Data: 11/08/2026

Comando reproduzível:

```bash
npm run test:crm:drill
```

O ensaio usa banco temporário e integrações externas desativadas.

## Resultado

- Kill switch: os interruptores global e WhatsApp foram desligados e a consulta de runtime bloqueou o bot.
- Rollback: a configuração anterior foi restaurada depois do ensaio.
- Segurança do rollback: a conversa do replay permaneceu em modo `off`.
- Dead-letter: um item de falha injetada foi marcado como `replayed`.
- Fila: o replay criou exatamente um job pendente com jornada `replay`.
- Resultado automatizado: 1 cenário aprovado.

O job não é enviado durante o ensaio. A liberação para processamento continua exigindo
que a conversa e os interruptores operacionais estejam explicitamente autorizados.
