Perfeito, Caio — agora segue **o PDD COMPLETO, atualizado com as CORES e FONTES reais do Delplata**, pronto para entregar ao WebBuilder.
Zero enrolação, estrutura profissional, e tudo já alinhado com o site atual.

---

# 🎨 **PDD – Product Design Document**

## **Hotel Pousada Delplata – Motor de Reservas + Site Oficial**

(versão final, completa e pronta para desenvolvimento)

---

# **1. Identidade Visual Oficial (baseada no site atual)**

### **1.1. Paleta de Cores (extraída do código da página)**

| Finalidade                                                    | Cor                   | HEX                       |
| ------------------------------------------------------------- | --------------------- | ------------------------- |
| **Cor Primária (institucional / rodapé / elementos escuros)** | Verde-musgo profundo  | **#283223**               |
| **Cor Secundária (CTA, títulos no rodapé)**                   | Dourado claro / oliva | **#BBB863**               |
| **Texto claro**                                               | Branco                | **#FFFFFF**               |
| **Interação WhatsApp / ação rápida**                          | Verde WhatsApp        | **#00E676**               |
| **Ripple do WhatsApp**                                        | Verde translucido     | `rgba(16, 231, 126, 0.3)` |

> ➜ Recomendação: manter **#283223 e #BBB863** como base do novo layout para preservar identidade visual.

---

### **1.2. Tipografia**

Conforme carregado no HTML original:

```html
Open Sans | Raleway | Poppins
```

**Uso recomendado no novo projeto:**

* **Títulos (H1–H3):**
  `Raleway, "Open Sans", sans-serif`

* **Textos / Parágrafos / Menus:**
  `Open Sans, Arial, sans-serif`

* **Destaques / Botões (opcional):**
  `Poppins, "Open Sans", sans-serif`

> ➜ Recomendação: manter **Open Sans + Raleway** como padrão principal para garantir coerência visual.

---

# **2. Arquitetura da Informação (Sitemap)**

```
Home
Acomodações
    • Apartamentos Térreo
    • Apartamentos Superior
    • Chalés
Galeria
Lazer
Restaurante
Pacotes / Promoções
Contato
Reservar (Motor de Reservas)

— Admin —
Login
Dashboard
Quartos (CRUD)
Tarifas (CRUD)
Inventário (calendário)
Reservas (listar, editar, cancelar)
Integrações
Configurações
```

---

# **3. Componentes (Design System)**

## **3.1. Widget de Busca (Home + Motor)**

* Check-in
* Check-out
* Adultos / Crianças
* Botão: **Buscar Disponibilidade** (cor primária #283223, texto branco)

## **3.2. Card de Quarto**

* Foto grande
* Nome
* Comodidades em ícones
* Capacidade
* Preço total
* Botão **Selecionar** (#283223)

## **3.3. Comodidades (com ícones)**

* Ar-condicionado (aptos superiores)
* Varanda (chalés)
* Smart TV (aptos anexos)
* Ventilador de teto (ala principal)
* Café a 70m (chalés)
* Microondas no bar
* Fogão 24h na área de churrasqueiras
* Piscina / Lazer

## **3.4. Calendário**

* Seletor de entrada/saída
* Datas bloqueadas desabilitadas
* Visual limpo (Open Sans)

## **3.5. Checkout**

* Nome
* E-mail
* Telefone
* Observações
* Aceite de termos (checkbox)
* Botão Mercado Pago

## **3.6. Tabela de Tarifas (Admin)**

Colunas:

* Tipo de quarto
* Período
* Valor
* Ações

## **3.7. Tabela de Reservas (Admin)**

* Hóspede
* Datas
* Quarto
* Valor
* Status (Pago, Pendente, Cancelado)
* Ações: Ver / Editar / Cancelar

---

# **4. Wireframes (Estrutura Visual)**

## **4.1. Home**

```
[Hero – foto grande]
[Título + subtítulo animado]
[Widget de busca]

[Acomodações – 3 cards grandes]
    - Superior
    - Térreo
    - Chalés

[Bloco Lazer]
[Bloco Restaurante]
[Mapa embutido]
[CTA: Pacotes e Promoções #BBB863 com link escuro #283223]
```

---

## **4.2. Página de Quarto**

```
[Carrossel de fotos]
[Título - Raleway]
[Descrição]
[Ícones de comodidades]
[Informações importantes]
    - Chalés → café 70m, sem ar
    - Aptos → Smart TV / Ar

[Botão Reservar (primário)]
```

---

## **4.3. Motor – Passo 1**

```
[Calendário]
[Adultos / Crianças]
[Botão Buscar]
```

---

## **4.4. Motor – Passo 2 – Quartos disponíveis**

```
[Título]
[Lista de quartos]
    [Card]
        Foto
        Nome
        Preço total
        Comodidades
        [Botão Selecionar]
```

---

## **4.5. Motor – Checkout**

```
[Resumo da reserva]
—
[Formulário]
Nome
E-mail
Telefone
Observações
Aceite LGPD
—
[Botão Pagar com Mercado Pago]
```

---

## **4.6. Tela de Confirmação**

```
[✔ Reserva Confirmada]
Número
Resumo
Instruções de check-in
Contato da pousada
```

---

# **5. Painel Administrativo – Fluxos**

## **5.1. Dashboard**

```
Reservas do dia
Próximas chegadas
Ocupação
```

## **5.2. Quartos (CRUD)**

```
Lista
Editar
Adicionar
Adicionar fotos
Salvar
```

## **5.3. Tarifas**

```
Calendário
Adicionar tarifa por período
Editar valores
```

## **5.4. Inventário**

```
Calendário
Fechar datas
Ajustar unidades disponíveis
```

## **5.5. Reservas**

```
Tabela
Ver reserva → editar → cancelar
Status do pagamento (via webhook Mercado Pago)
```

## **5.6. Integrações**

* Mercado Pago
* E-mail
* iCal

---

# **6. Interações e Comportamento**

### **Estados**

* Loading digital (spinner)
* Erros de pagamento
* Datas indisponíveis
* Reserva pendente / paga

### **Regras**

* Apenas datas com inventário aparecem
* Cancelamento libera inventário
* Webhook Mercado Pago atualiza status da reserva
* E-mails enviados automaticamente

---

# **7. Padrões Visuais (para WebBuilder)**

### **Botões**

**Primário:**

* Fundo: `#283223`
* Texto: `#FFFFFF`
* Hover: 90% opacidade

**Secundário:**

* Borda `#283223`
* Texto `#283223`
* Fundo branco

**CTA Promocional:**

* Fundo: `#BBB863`
* Texto: `#283223`

---

# **8. Requisitos Técnicos para Desenvolvimento**

### **Frontend**

* Mobile-first
* Carregar Google Fonts (Open Sans, Raleway, Poppins)
* Layout baseado nas cores acima

### **Backend**

* API REST para:

  * Quartos
  * Tarifas
  * Inventário
  * Reservas
  * Pagamentos
* Webhook Mercado Pago
* Sistema de permissões (apenas Admin no MVP)

### **Banco**

* RoomType
* Rate
* InventoryAdjust
* Booking
* Guest
* Payment
* Photo

---

# **9. Entregáveis do WebBuilder**

✔ Site completo responsivo
✔ Motor integrado com Mercado Pago
✔ Painel administrativo funcional
✔ E-mails automáticos configurados
✔ iCal funcionando
✔ Todas as telas conforme wireframes
✔ Cores e fontes do Delplata aplicadas
✔ Manual rápido de uso

---

# **10. Pacote final para entrega ao cliente**

* PRD
* PDD
* Paleta oficial
* Tipografia oficial
* Lista de telas
* Arquitetura
* Fluxos
* Componentes
* Checklists de teste

---
