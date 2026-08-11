# Piloto supervisionado do CRM

Data de validação: 11/08/2026

## Comportamento validado

- Uma conversa em modo `supervised` não executa resposta automática.
- O webhook pode criar uma sugestão somente a partir de regra pública, ativa e aprovada.
- Mensagem sem correspondência aprovada não gera texto improvisado.
- A Inbox mostra a sugestão separada do campo de resposta.
- O atendente precisa clicar em **Usar sugestão** e depois em **Enviar**.
- Texto alterado não pode reutilizar a autorização da sugestão original.
- Aprovação, atendente e mensagem enviada ficam auditados.
- Descartar uma sugestão não envia mensagem.

## Operação do piloto

1. Abra uma conversa na Inbox.
2. Selecione o modo **Supervisionado**.
3. Aguarde uma mensagem do hóspede que corresponda à base aprovada.
4. Revise a sugestão apresentada acima da caixa de resposta.
5. Use e envie somente se estiver correta; caso contrário, descarte e responda manualmente.

O interruptor geral e o rollout percentual não transformam uma conversa supervisionada
em automática. A mudança para `auto` continua sendo uma ação explícita do administrador.
