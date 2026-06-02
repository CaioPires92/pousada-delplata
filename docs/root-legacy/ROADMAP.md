# Roadmap Consolidado

Documento único para planejamento, próximos passos e melhorias pós-deploy.

## � Próximos Passos (Implementação)

- **Página de Reservas (`/reservar`)**
  - Buscar disponibilidade via `/api/availability`
  - Exibir preço total por quarto e checkout
  - Formulário com nome, email, telefone e aceite de termos
- **Integração Mercado Pago**
  - Criar preferência de pagamento
  - Webhook para atualizar Payment/Booking
  - Página de confirmação `/reservar/confirmacao/[bookingId]`
- **Email Transacional**
  - Enviar confirmação ao hóspede e notificação ao admin
- **Painel Administrativo**
  - Login, Dashboard, Quartos, Tarifas, Reservas
  - Middleware protegendo `/admin/*`
- **iCal Export (baixa prioridade)**
  - Gerar `.ics` com reservas confirmadas por quarto
- **Páginas Estáticas (baixa prioridade)**
  - Lazer, Restaurante, Contato, Políticas
- **Melhorias**
  - Loading/Error/Toasts, SEO, Analytics, Performance

## 🎯 Roadmap Sugerido (Semana a Semana)

- Semana 1: Página `/reservar` completa + Mercado Pago (sandbox)
- Semana 2: Emails + Admin (Login/Dashboard/Quartos)
- Semana 3: Admin (Tarifas/Reservas) + páginas estáticas + iCal
- Semana 4: Testes finais + Deploy + Treinamento

## 🚨 Pós-Deploy (Curto Prazo)

- Rotação de secrets (`ADMIN_JWT_SECRET`)
- Monitoramento de logs (Vercel/Sentry)
- Backup automático do banco Turso

## 🛡️ Segurança e Infraestrutura

- Rate limit global com Upstash Redis
- MFA (TOTP ou código via email)
- Invalidação de sessão (AdminSession/Redis blacklist)
- Auditoria (AuditLog)

## 🎨 UX e Funcionalidades (Painel Admin)

- Recuperação de senha via email
- Gerenciamento de administradores
- Dashboard de métricas (ocupação, receita, previsões)

## 🧹 Débito Técnico Aceitável

- Unificar tipos de Admin entre front/back
- Testes E2E com Playwright

---
*Atualizado: 02/02/2026*
