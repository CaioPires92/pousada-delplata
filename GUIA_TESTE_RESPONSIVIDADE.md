# 📱 GUIA DE TESTE MANUAL DE RESPONSIVIDADE

## 🚀 Como Testar

### Opção 1: Ferramenta Visual (Recomendado)

1. **Abra o arquivo de teste:**
   ```
   web/test-responsive-manual.html
   ```
   
2. **Abra no navegador:**
   - Clique duplo no arquivo
   - Ou arraste para o navegador

3. **Teste cada resolução:**
   - Verifique se o layout está correto
   - Clique em "Testar Interação"
   - Marque como PASSOU ou FALHOU

---

### Opção 2: DevTools do Chrome

1. **Abra o site:**
   ```
   http://localhost:3001
   ```

2. **Abra DevTools:**
   - Pressione `F12`
   - Ou `Ctrl + Shift + I`

3. **Ative o Device Mode:**
   - Pressione `Ctrl + Shift + M`
   - Ou clique no ícone de celular 📱

4. **Teste cada resolução:**
   
   **Mobile:**
   - iPhone SE (375x667)
   - iPhone 12 Pro (390x844)
   - Pixel 5 (393x851)

   **Tablet:**
   - iPad (768x1024)
   - iPad Pro (1024x1366)

   **Desktop:**
   - Laptop (1280x720)
   - Desktop (1440x900)
   - Full HD (1920x1080)

---

## ✅ O QUE VERIFICAR

### 1. Layout Geral
- [ ] Sem scroll horizontal
- [ ] Elementos não quebram
- [ ] Espaçamentos adequados
- [ ] Margens e paddings corretos

### 2. Tipografia
- [ ] Textos legíveis (min 16px em mobile)
- [ ] Hierarquia visual clara
- [ ] Line-height adequado
- [ ] Sem textos cortados

### 3. Imagens
- [ ] Não distorcidas
- [ ] Carregam corretamente
- [ ] Tamanho adequado
- [ ] Alt text presente

### 4. Navegação
- [ ] Menu acessível
- [ ] Links clicáveis
- [ ] Área de toque adequada (min 44px)
- [ ] Breadcrumbs visíveis

### 5. Formulários
- [ ] Inputs com tamanho adequado
- [ ] Labels visíveis
- [ ] Botões grandes o suficiente
- [ ] Validação clara
- [ ] Teclado não esconde campos

### 6. Botões e CTAs
- [ ] Tamanho mínimo 44x44px
- [ ] Espaçamento adequado
- [ ] Estados hover/focus visíveis
- [ ] Texto legível

### 7. Cards e Grids
- [ ] Responsivos (mudam colunas)
- [ ] Espaçamento consistente
- [ ] Conteúdo não quebra
- [ ] Imagens proporcionais

### 8. Tabelas
- [ ] Scroll horizontal em mobile (se necessário)
- [ ] Cabeçalhos fixos
- [ ] Dados legíveis
- [ ] Ações acessíveis

---

## 🐛 PROBLEMAS COMUNS

### Mobile
- ❌ Texto muito pequeno
- ❌ Botões muito pequenos
- ❌ Elementos sobrepostos
- ❌ Scroll horizontal
- ❌ Menu quebrado

### Tablet
- ❌ Layout desktop em tela pequena
- ❌ Espaços vazios demais
- ❌ Imagens muito grandes
- ❌ Navegação confusa

### Desktop
- ❌ Conteúdo muito largo
- ❌ Textos muito longos
- ❌ Imagens pixelizadas
- ❌ Espaços vazios excessivos

---

## 📸 CAPTURAS DE TELA

Para cada página, capture:

1. **Mobile (375px)**
   - Homepage
   - Página de Reserva
   - Confirmação
   - Admin Login
   - Admin Dashboard

2. **Tablet (768px)**
   - Mesmas páginas

3. **Desktop (1440px)**
   - Mesmas páginas

Salvar em: `screenshots/responsividade/`

---

## 📊 TEMPLATE DE RELATÓRIO

```markdown
## Página: [Nome]
## Resolução: [Largura x Altura]

### Status: ✅ PASSOU / ❌ FALHOU

### Problemas Encontrados:
- [ ] Problema 1
- [ ] Problema 2

### Screenshots:
- Anexar imagem

### Observações:
- Comentários adicionais
```

---

## 🎯 CRITÉRIOS DE APROVAÇÃO

Para PASSAR, a página deve:

1. ✅ Carregar sem erros
2. ✅ Ser totalmente funcional
3. ✅ Ter boa legibilidade
4. ✅ Permitir todas as ações
5. ✅ Não ter scroll horizontal
6. ✅ Elementos bem posicionados
7. ✅ Performance adequada

---

## 💡 DICAS

1. **Teste em dispositivos reais** quando possível
2. **Use diferentes navegadores** (Chrome, Firefox, Safari, Edge)
3. **Teste orientação** (portrait e landscape)
4. **Verifique performance** em conexões lentas
5. **Teste com zoom** (acessibilidade)

---

## 🔧 FERRAMENTAS ÚTEIS

### Online
- [Responsinator](http://www.responsinator.com/)
- [BrowserStack](https://www.browserstack.com/)
- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)

### Extensões Chrome
- Window Resizer
- Responsive Viewer
- Mobile Simulator

### DevTools
- Chrome DevTools (Device Mode)
- Firefox Responsive Design Mode
- Safari Web Inspector

---

**Última Atualização:** 26/11/2025  
**Responsável:** QA Team
