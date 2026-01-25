Aqui está o plano de ação detalhado para levar o sistema do MVP (Beta) para a V1.0 (Profissional).

## Fase 1: Proteção de Rotas (Segurança Admin)
**Objetivo:** Impedir que usuários não autorizados acessem o painel administrativo apenas digitando a URL.

1.  **Criar `src/middleware.ts`**:
    -   Interceptar todas as rotas `/admin/*` (exceto `/admin/login`).
    -   Verificar a presença de um cookie de sessão seguro (vamos migrar do `localStorage` para `cookies` no login para maior segurança, ou validar via server-side se possível, mas para MVP rápido o middleware pode checar presença de cookie).
    -   *Nota:* Como o login atual usa `localStorage` (client-side), o middleware (server-side) não consegue ler. **Plano de ajuste:** Alterar o login para setar um cookie `admin_token` ao invés de apenas localStorage.
    -   Redirecionar para `/admin/login` se não autenticado.

## Fase 2: Emails Transacionais (Confirmação)
**Objetivo:** Automatizar o envio de vouchers.

1.  **Validar `src/lib/email.ts`**: O código já está pronto e parece sólido (usa `nodemailer`).
2.  **Integração no Webhook**: O webhook (`src/app/api/webhooks/mercadopago/route.ts`) já tem a lógica de chamada:
    ```typescript
    if (paymentInfo.status === 'approved') { ... sendBookingConfirmationEmail(...) }
    ```
3.  **Ação Necessária**: Garantir que as variáveis de ambiente `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` estejam configuradas no ambiente de produção (Vercel/env).

## Fase 3: Validação do Webhook (Pagamentos Reais)
**Objetivo:** Garantir que o sistema receba o "OK" do Mercado Pago.

1.  **Teste de Webhook (Simulado)**:
    -   Criar um script ou teste unitário que posta um payload falso de "Pagamento Aprovado" para a rota `/api/webhooks/mercadopago`.
    -   Verificar se o status da reserva muda para `CONFIRMED` no banco.

---

**Minha recomendação:** Começar pela **Fase 1 (Middleware de Segurança)**, pois é o maior risco de segurança atual. Posso criar o middleware e ajustar o login para usar Cookies?