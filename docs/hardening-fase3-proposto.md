# FASE 3 - Hardening Proposto (NÃO aplicado)

## Status
Documento de proposta + diff sugerida. Nenhuma alteração desta fase foi aplicada no código.

## 1) Unificar TTL do cron com `PENDING_BOOKING_TTL_MINUTES`

### Problema atual
- `src/app/api/cron/cleanup-bookings/route.ts` usa valores hardcoded de 15/30 minutos.
- O projeto já possui `PENDING_BOOKING_TTL_MINUTES` em `.env.example`.

### Proposta
- Derivar os dois pontos do cron por env:
  - lembrete: `ttl / 2`
  - expiração: `ttl`
- Fallback padrão: `30` minutos.

### Diff sugerida (não aplicada)
```diff
diff --git a/src/app/api/cron/cleanup-bookings/route.ts b/src/app/api/cron/cleanup-bookings/route.ts
@@
+function getPendingBookingTtlMinutes() {
+  const raw = Number.parseInt(String(process.env.PENDING_BOOKING_TTL_MINUTES || '30'), 10);
+  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 24 * 60) : 30;
+}
@@
-const quinzeMinutosAtras = new Date(Date.now() - 15 * 60 * 1000);
-const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000);
+const ttlMinutes = getPendingBookingTtlMinutes();
+const reminderMinutes = Math.max(1, Math.floor(ttlMinutes / 2));
+const pendingReminderCutoff = new Date(Date.now() - reminderMinutes * 60 * 1000);
+const pendingExpireCutoff = new Date(Date.now() - ttlMinutes * 60 * 1000);
@@
-createdAt: { lt: quinzeMinutosAtras },
+createdAt: { lt: pendingReminderCutoff },
@@
-createdAt: { lt: trintaMinutosAtras },
+createdAt: { lt: pendingExpireCutoff },
```

## 2) Marcar `pendingEmailSentAt` somente após envio com sucesso

### Problema atual
- O cron dispara `sendBookingPendingEmail(...)` sem `await`.
- `pendingEmailSentAt` é marcado imediatamente, inclusive em falha.

### Proposta
- `await` do envio.
- Só atualizar `pendingEmailSentAt` quando `result.success === true`.
- Logar falhas por booking para reprocessamento no próximo cron.

### Diff sugerida (não aplicada)
```diff
diff --git a/src/app/api/cron/cleanup-bookings/route.ts b/src/app/api/cron/cleanup-bookings/route.ts
@@
-sendBookingPendingEmail({...})
-  .then((r) => {
-    if (r && (r as any).success) pendingEmailCount++;
-  })
-  .catch(() => {});
-
-await prisma.booking.update({
-  where: { id: booking.id },
-  data: { pendingEmailSentAt: new Date() },
-});
+const pendingResult = await sendBookingPendingEmail({...}).catch(() => ({ success: false }));
+if (pendingResult && (pendingResult as any).success) {
+  pendingEmailCount++;
+  await prisma.booking.update({
+    where: { id: booking.id },
+    data: { pendingEmailSentAt: new Date() },
+  });
+} else {
+  console.warn('[Cron Cleanup] Falha ao enviar email pendente', { bookingId: booking.id });
+}
```

## 3) Documentar/agendar cron na Vercel

### Problema atual
- Endpoint de cron existe, mas não há garantia de agendamento em produção.

### Proposta
- Adicionar `vercel.json` com cron programado e documentação no README.

### Diff sugerida (não aplicada)
```diff
diff --git a/vercel.json b/vercel.json
new file mode 100644
@@
+{
+  "crons": [
+    {
+      "path": "/api/cron/cleanup-bookings",
+      "schedule": "*/5 * * * *"
+    }
+  ]
+}
```

## 4) Atualizar `.env.example` com variáveis operacionais

### Proposta
Adicionar explicitamente:
- `CRON_SECRET`
- `ADMIN_JWT_SECRET`
- `ADMIN_ASSIST_EMAIL_COOLDOWN_MINUTES`
- `CONTACT_RECEIVER_EMAIL`
- `ALWAYS_BCC_EMAIL`
- `HOTEL_NAME`
- `HOTEL_EMAIL`
- `HOTEL_WHATSAPP`
- `HOTEL_WHATSAPP_LINK`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `GA4_MEASUREMENT_ID`
- `GA4_API_SECRET`

### Diff sugerida (não aplicada)
```diff
diff --git a/.env.example b/.env.example
@@
-JWT_SECRET=<SEU_JWT_SECRET>
+JWT_SECRET=<SEU_JWT_SECRET>
+ADMIN_JWT_SECRET=<SEU_ADMIN_JWT_SECRET>
+CRON_SECRET=<SEU_CRON_SECRET>
@@
+ADMIN_ASSIST_EMAIL_COOLDOWN_MINUTES=30
+CONTACT_RECEIVER_EMAIL=contato@pousadadelplata.com.br
+ALWAYS_BCC_EMAIL=financeiro@pousadadelplata.com.br
+HOTEL_NAME=Hotel Pousada Delplata
+HOTEL_EMAIL=contato@pousadadelplata.com.br
+HOTEL_WHATSAPP=(19)99999-9999
+HOTEL_WHATSAPP_LINK=https://wa.me/5519999999999
```

## Riscos e cuidados
- Evitar envio duplicado de e-mail: ideal adicionar idempotência por booking + tipo de lembrete.
- Rodar cron em frequência baixa pode atrasar expiração real.
- Em produção, proteger sempre `CRON_SECRET` e não expor endpoint sem autenticação.
