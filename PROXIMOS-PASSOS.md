# 🚀 Próximos Passos - Delplata-Motor

## ✅ O que já está pronto (100%)

### Backend Completo
- ✅ Database Schema (8 modelos)
- ✅ API Routes (Rooms, Rates, Inventory, Availability, Bookings, Auth)
- ✅ Lógica de disponibilidade com cálculo de preço
- ✅ Sistema de autenticação Admin (JWT)

### Frontend Core
- ✅ Home page com Hero e Search Widget
- ✅ Página de listagem de quartos
- ✅ Página de detalhes do quarto
- ✅ Design System aplicado (cores #283223, #BBB863, fontes Google)
- ✅ Header e Footer
- ✅ Responsivo (mobile-first)

## 📋 Próximos Passos (Prioridade)

### 1. Página de Reservas (`/reservar`) - ALTA PRIORIDADE

**Objetivo:** Exibir quartos disponíveis e permitir checkout

**Tarefas:**
- [ ] Criar `/src/app/reservar/page.tsx`
- [ ] Buscar quartos disponíveis via API `/api/availability`
- [ ] Exibir cards de quartos com preço total calculado
- [ ] Botão "Selecionar" por quarto
- [ ] Formulário de checkout:
  - Nome completo
  - Email
  - Telefone
  - Observações (opcional)
  - Checkbox aceite LGPD/termos
- [ ] Resumo da reserva (quarto, datas, valor total)
- [ ] Botão "Finalizar Reserva"

**Fluxo:**
```
Home → Buscar → /reservar?checkIn=...&checkOut=... → Selecionar quarto → Preencher dados → Confirmar
```

### 2. Integração Mercado Pago - ALTA PRIORIDADE

**Objetivo:** Processar pagamentos online

**Tarefas:**
- [ ] Instalar SDK: `npm install mercadopago`
- [ ] Configurar credenciais (Public Key, Access Token) no `.env`
- [ ] Criar `/src/app/api/mercadopago/create-preference/route.ts`
  - Recebe dados da reserva
  - Cria preferência de pagamento no MP
  - Retorna `init_point` (URL de pagamento)
- [ ] Criar `/src/app/api/webhooks/mercadopago/route.ts`
  - Recebe notificações do MP
  - Atualiza status do Payment
  - Atualiza status do Booking para "CONFIRMED"
- [ ] No checkout, ao clicar "Pagar":
  - Criar booking via `/api/bookings`
  - Criar preferência MP
  - Redirecionar para `init_point`
- [ ] Página de confirmação `/reservar/confirmacao/[bookingId]`

**Referência:**
- [Docs Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integrate-checkout-pro)

### 3. Email Transacional - MÉDIA PRIORIDADE

**Objetivo:** Enviar confirmações automáticas

**Tarefas:**
- [ ] Instalar: `npm install nodemailer`
- [ ] Configurar SMTP no `.env` (Gmail, SendGrid, etc)
- [ ] Criar `/src/lib/email.ts` com funções:
  - `sendBookingConfirmation(booking, guest)`
  - `sendAdminNotification(booking)`
- [ ] Integrar no webhook do MP:
  - Quando payment.approved → enviar email ao guest
  - Enviar notificação ao admin
- [ ] Template de email HTML com:
  - Número da reserva
  - Dados do quarto
  - Datas (check-in, check-out)
  - Valor total
  - Instruções de check-in
  - Contato do hotel

### 4. Painel Administrativo - MÉDIA PRIORIDADE

**Objetivo:** Interface para gerenciar o sistema

**Estrutura:**
```
/admin
  /login → Página de login
  /dashboard → Visão geral (próximas chegadas, ocupação)
  /quartos → CRUD de quartos
    /novo
    /[id]/editar
  /tarifas → Gerenciar tarifas e inventário
  /reservas → Lista de reservas
    /[id] → Detalhes e ações
  /configuracoes → Integrações (MP, Email)
```

**Tarefas:**
- [ ] Criar middleware de autenticação (`/src/middleware.ts`)
  - Verificar cookie `admin_token`
  - Proteger rotas `/admin/*`
- [ ] Páginas Admin:
  - [ ] Login (`/admin/login/page.tsx`)
  - [ ] Dashboard (`/admin/dashboard/page.tsx`)
  - [ ] Gestão de Quartos (`/admin/quartos/page.tsx`)
  - [ ] Gestão de Tarifas (`/admin/tarifas/page.tsx`)
  - [ ] Lista de Reservas (`/admin/reservas/page.tsx`)
- [ ] Componentes:
  - [ ] Sidebar de navegação
  - [ ] Calendário para tarifas/inventário
  - [ ] Tabela de reservas com filtros

### 5. iCal Export - BAIXA PRIORIDADE

**Objetivo:** Sincronizar calendário com outras plataformas (Airbnb, Booking)

**Tarefas:**
- [ ] Criar `/src/app/api/ical/[roomTypeId]/route.ts`
- [ ] Gerar arquivo `.ics` com formato padrão iCal
- [ ] Incluir todas as reservas confirmadas do quarto
- [ ] Exemplo de URL: `https://delplata.com/api/ical/room-id-123.ics`

**Formato iCal:**
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Delplata//Booking//PT
BEGIN:VEVENT
UID:booking-uuid
DTSTART:20251121
DTEND:20251123
SUMMARY:Reservado - João Silva
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

### 6. Páginas Estáticas - BAIXA PRIORIDADE

**Objetivo:** Conteúdo informativo

**Tarefas:**
- [ ] `/lazer/page.tsx` - Descrição das áreas de lazer
- [ ] `/restaurante/page.tsx` - Informações sobre o restaurante
- [ ] `/contato/page.tsx` - Formulário de contato + mapa
- [ ] `/politicas/page.tsx` - Políticas de cancelamento, check-in/out

### 7. Melhorias e Polimento - BAIXA PRIORIDADE

**Tarefas:**
- [ ] Loading states (spinners durante chamadas API)
- [ ] Error handling (mensagens amigáveis)
- [ ] Toast notifications (confirmações visuais)
- [ ] Otimização de imagens (Next.js Image component)
- [ ] SEO (meta tags, sitemap.xml)
- [ ] Analytics (Google Analytics)
- [ ] Performance (Lighthouse score)

## 🎯 Roadmap Sugerido

### Semana 1
1. ✅ Backend + Frontend Core (COMPLETO)
2. **Página `/reservar`** com fluxo completo
3. **Integração Mercado Pago** (sandbox)

### Semana 2
4. **Email Transacional** configurado
5. **Painel Admin** - Login + Dashboard + Quartos

### Semana 3
6. **Painel Admin** - Tarifas + Reservas
7. **Páginas estáticas** (Lazer, Contato, Políticas)
8. **iCal Export**

### Semana 4
9. **Testes finais** (100% coverage)
10. **Deploy** (Vercel + produção)
11. **Treinamento** do cliente

## 🔧 Para Testar Agora

O servidor está rodando em **http://localhost:3003**

Execute os testes:
```powershell
cd web
powershell -ExecutionPolicy Bypass -File scripts/test-api.ps1
```

Ou acesse manualmente:
- **Home:** http://localhost:3003
- **Quartos:** http://localhost:3003/acomodacoes
- **API Docs:** Ver próximos detalhes in `test-guide.md`

## 📞 Decisões Necessárias

Antes de prosseguir, confirme:

1. **Mercado Pago:**
   - Você já tem conta Mercado Pago?
   - Prefere integração Sandbox primeiro ou já produção?

2. **Email:**
   - Qual serviço usar? (Gmail SMTP, SendGrid, AWS SES)
   - Qual endereço de email remetente? (ex: reservas@delplata.com.br)

3. **Prioridades:**
   - Começar por **Reservas + Mercado Pago** (fluxo completo)?
   - Ou prefere **Painel Admin** primeiro?

4. **Deploy:**
   - Hospedagem preferida? (Vercel, AWS, outro)
   - Domínio já registrado? (www.delplata.com.br)

## ✨ Próximo Passo Imediato

**Recomendo:** Implementar a **Página de Reservas (`/reservar`)** primeiro, pois é o core do sistema e permite testar o fluxo completo end-to-end.

Posso começar agora se você quiser! 🚀
