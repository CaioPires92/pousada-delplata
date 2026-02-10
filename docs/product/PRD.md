Perfeito, Caio.
Então você precisa de uma versão **enxuta, técnica e objetiva**, contendo **apenas o que um WebBuilder realmente precisa** para construir o site + motor de reservas. Nada de narrativa, nada de estratégia. Só requisitos funcionais, integrações e entregáveis.

Segue o pacote cirúrgico — pronto pra colar no WebBuilder.

---

# ✅ **PRD Enxuto – Entregável para WebBuilder**

**Hotel Pousada Delplata – Motor de Reservas + Site**

---

# **1. Objetivo Técnico**

Construir um **site responsivo** com um **motor de reservas integrado**, incluindo:

* Busca de disponibilidade por datas
* Seleção de quarto e extras
* Checkout com pagamento online (Mercado Pago)
* Confirmações por e-mail
* Painel administrativo para gerenciar quartos, tarifas e reservas
* Exportação de calendário via iCal
* CMS para editar páginas e galeria

---

# **2. Funcionalidades Obrigatórias (MVP)**

### **2.1. Site Público**

* Responsivo (mobile-first)
* Páginas:

  * Home
  * Sobre
  * Quartos
  * Galeria
  * Lazer
  * Políticas
  * Contato
* Botão **“Reservar Agora”** levando ao motor integrado
* Fotos em galeria/carrossel

### **2.2. Motor de Reservas**

* Widget de busca com:

  * Check-in / Check-out
  * Adultos / Crianças
* Resultado mostrando quartos disponíveis com:

  * Fotos
  * Comodidades
  * Preço total por período
* Seleção de extras (campo genérico, mesmo que não usado no MVP)
* Checkout:

  * Dados do hóspede (nome, e-mail, telefone)
  * Aceite de termos/políticas (LGPD)
  * Pagamento via Mercado Pago
* Página de confirmação da reserva

---

# **3. Painel Administrativo**

### **3.1. Gestão de Quartos**

CRUD:

* Nome
* Descrição
* Capacidade
* Comodidades
* Fotos
* Preço base (default)

### **3.2. Tarifas e Inventário**

* Definir tarifas por período (date range + price)
* Fechar datas/noites específicas
* Atualizar número de unidades disponíveis
* Calendário visual de tarifas e disponibilidade

### **3.3. Reservas**

* Listar reservas por data/status
* Ver detalhes (hóspede, datas, pagamento)
* Editar dados (nome, telefone, observações)
* Cancelar reserva (liberando inventário)
* Marcar reserva como paga se manual

---

# **4. Pagamentos – Mercado Pago (Obrigatório)**

### **Integração:**

* Checkout Pro ou Embedded (decisão técnica do WebBuilder)
* Usar **Access Token** + **Public Key**
* Webhooks obrigatórios:

  * payment.approved
  * payment.refunded
  * payment.cancelled
  * payment.rejected

### **Fluxo esperado:**

1. Hóspede paga
2. Mercado Pago envia webhook
3. Sistema:

   * atualiza reserva para “Paga”
   * envia confirmação por e-mail

---

# **5. E-mails Transacionais**

Enviar automaticamente:

### **5.1. Para o Hóspede**

* Confirmação da reserva (detalhes + recibo básico)
* E-mail de cancelamento (se cancelada pelo admin)

### **5.2. Para o Admin**

* Notificação de nova reserva

### **Conteúdo mínimo obrigatório dos e-mails:**

* Nome do hóspede
* Datas da estadia
* Tipo de quarto
* Valor total
* Política de cancelamento
* Instruções de chegada
* Contato do hotel

---

# **6. Integrações**

### **6.1. iCal Export**

* Gerar link de calendário do tipo “/ical/[roomtype].ics”
* Cada tipo de quarto expõe suas reservas ocupadas

### **6.2. CMS**

* Admin pode editar:

  * Textos das páginas
  * Fotos da galeria
  * Fotos dos quartos

---

# **7. Dados Específicos do Hotel (Obrigatórios)**

Essas informações precisam constar nas páginas e descrições dos quartos:

### **7.1. Chalés**

* Com varanda
* Sem ar-condicionado
* Café da manhã a **70 metros**
* Acesso à área de churrasqueira

### **7.2. Apartamentos Anexos**

* Sem varanda
* Com Smart TV
* Sem copa (usar microondas no bar)

### **7.3. Apartamentos – Ala Principal**

* Com ar-condicionado
* Com ventilador de teto
* Mais próximos do café

### **7.4. Informações gerais do hotel**

* Microondas fica no bar
* Fogão disponível 24h na área da churrasqueira
* Check-in 14h
* Check-out 12h

---

# **8. Requisitos Técnicos**

### **Frontend**

* Responsivo
* Carregamento rápido (LCP otimizado)
* Compatível com celular (mais de 70% dos hóspedes do Delplata)

### **Backend**

* API para:

  * Quartos
  * Tarifas
  * Inventário
  * Reservas
  * Pagamentos
* Webhooks do Mercado Pago
* Autenticação para admin

### **Banco de Dados (modelo mínimo)**

* RoomType
* Rate
* InventoryAdjustment
* Booking
* Guest
* Payment
* AdminUser
* Photos

---

# **9. Critérios de Aceite (Checklist)**

### **Sistema só passa como “Pronto” se:**

* Usuário consegue buscar disponibilidade
* Conseguir reservar e pagar pelo Mercado Pago
* Admin consegue ver e confirmar reservas
* E-mails chegam corretamente
* Inventário atualiza após reserva
* iCal export funciona
* Cancelamento libera a data
* Tudo funciona no mobile

---

# **10. Entregáveis finais**

1. Site público completo
2. Motor de reservas integrado
3. Painel administrativo funcional
4. Integração Mercado Pago ativa
5. E-mails transacionais configurados
6. iCal funcional
7. Tutoriais:

   * Como alterar tarifas
   * Como alterar inventário
   * Como ver/cancelar reservas

---

## **Se quiser, posso agora gerar também:**

📌 Versão “super resumida” (1 página) só com bullet points
📌 Versão traduzida para inglês (caso o WebBuilder não seja brasileiro)
📌 Arquivo PDF bonitão com capa “Delplata – PRD Oficial”

Só pedir.
