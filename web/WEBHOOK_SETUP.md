# Configuração de Webhooks do Mercado Pago

## O que são Webhooks?

Webhooks são notificações automáticas que o Mercado Pago envia para o seu servidor quando algo importante acontece (como um pagamento ser aprovado).

## Como Funciona

1. Cliente faz um pagamento no Mercado Pago
2. Mercado Pago processa o pagamento
3. Mercado Pago envia uma notificação para o seu webhook
4. Seu servidor atualiza o status da reserva automaticamente
5. Email de confirmação é enviado para o cliente

## Configuração no Painel do Mercado Pago

### Passo 1: Acessar o Painel

1. Vá em: https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua aplicação
3. Clique em "Webhooks" no menu lateral

### Passo 2: Adicionar URL do Webhook

**Para PRODUÇÃO:**
```
https://pousada-delplata.vercel.app/api/mercadopago/webhook
```

**Para TESTE:**
```
https://pousada-delplata.vercel.app/api/mercadopago/webhook
```
(A mesma URL funciona para teste e produção)

### Passo 3: Selecionar Eventos

Marque apenas:
- ✅ **Pagamentos** (Payments)

Desmarque todos os outros eventos.

### Passo 4: Salvar

Clique em "Salvar" e pronto!

## Testando o Webhook

### Teste Manual (Recomendado)

1. Faça uma reserva de teste no site
2. Complete o pagamento com cartão de teste
3. Aguarde alguns segundos
4. Verifique:
   - Status da reserva foi atualizado no banco
   - Email de confirmação foi enviado
   - Logs aparecem no console da Vercel

### Teste com Simulador do Mercado Pago

1. No painel do Mercado Pago, vá em "Webhooks"
2. Clique em "Simular notificação"
3. Selecione "payment"
4. Clique em "Enviar"
5. Verifique os logs

## Verificando se Está Funcionando

### 1. Verificar Endpoint

Acesse no navegador:
```
https://pousada-delplata.vercel.app/api/mercadopago/webhook
```

Deve retornar:
```json
{
  "status": "Webhook endpoint is active",
  "timestamp": "2025-11-25T..."
}
```

### 2. Verificar Logs na Vercel

1. Vá em: https://vercel.com/seu-projeto
2. Clique em "Logs"
3. Procure por mensagens com `[Webhook]`

### 3. Verificar Banco de Dados

Após um pagamento, verifique se:
- Status do `Payment` foi atualizado
- Status do `Booking` mudou para `CONFIRMED`

## Fluxo Completo

```
1. Cliente faz reserva → Status: PENDING
2. Cliente paga no Mercado Pago
3. Mercado Pago envia webhook → /api/mercadopago/webhook
4. Webhook atualiza Payment → Status: APPROVED
5. Webhook atualiza Booking → Status: CONFIRMED
6. Webhook envia email → /api/emails/send-confirmation
7. Cliente recebe email de confirmação ✅
```

## Possíveis Status

### Payment Status
- `PENDING` - Aguardando pagamento
- `APPROVED` - Pagamento aprovado
- `REJECTED` - Pagamento rejeitado
- `CANCELLED` - Pagamento cancelado
- `IN_PROCESS` - Em processamento

### Booking Status
- `PENDING` - Aguardando confirmação
- `CONFIRMED` - Confirmada (pagamento aprovado)
- `CANCELLED` - Cancelada (pagamento rejeitado)

## Troubleshooting

### Webhook não está sendo chamado

1. Verifique se a URL está correta no painel do Mercado Pago
2. Verifique se o evento "Payments" está marcado
3. Verifique se o deploy da Vercel foi concluído
4. Teste com o simulador do Mercado Pago

### Email não está sendo enviado

1. Verifique as variáveis de ambiente SMTP no Vercel
2. Verifique os logs para erros de email
3. Teste o endpoint de email diretamente

### Status não está atualizando

1. Verifique os logs do webhook
2. Verifique se o `external_reference` está correto
3. Verifique a conexão com o banco de dados

## Segurança

O webhook valida:
- ✅ Assinatura do Mercado Pago (x-signature)
- ✅ Request ID (x-request-id)
- ✅ Busca dados direto da API do Mercado Pago (não confia apenas no webhook)

## Próximos Passos

Depois de configurar os webhooks:
1. Teste com pagamento real (pequeno valor)
2. Verifique se o email chegou
3. Verifique se o status foi atualizado
4. Configure notificações de erro (opcional)
