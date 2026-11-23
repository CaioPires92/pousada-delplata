# Design system do novo layout — Pousada Delplata

Documento vivo, **complementar** ao design system estratégico `docs/design-system.md` (direção de marca, posicionamento e princípios). Este aqui descreve o que **já está no código** do modelo do novo layout (branch `feat/novo-layout-paraiso`) e as regras para manter o site coerente. Se uma regra daqui não bater com o código, o código é a verdade e este arquivo deve ser corrigido.

Arquivos de referência:
- Tokens de cor e tipografia: `src/app/globals.css`, `tailwind.config.ts`, `src/app/fonts.ts`
- Componentes e utilitários da home: `src/components/home-novo/` (`home-novo.module.css`)
- Ícone e favicon: `src/app/favicon.ico`, `icon.png`, `apple-icon.png`

## 0. Divergências em relação a `docs/design-system.md` (decisão pendente do dono)
O documento estratégico define: "refúgio familiar + hotel boutique + luxo editorial", silêncio visual, muito respiro, poucos cartões. O modelo do novo layout, feito a partir da Pousada Paraíso e do site do Pedro, **diverge** em pontos que precisam de decisão:

| Tema | `docs/design-system.md` | Modelo do novo layout | Decisão |
|---|---|---|---|
| Fonte dos títulos | Inter 600 nas seções; Bodoni Moda 700 **só** no título do hero | Bricolage Grotesque caixa alta + Instrument Serif itálico em **todos** os títulos | ? |
| Cantos | só 8 / 16 / 24 px | cantos retos (0 px) | ? |
| Espaço entre seções | 120 / 160 / 220 px, "respirar como editorial" | seções de até 100vh, 32–104 px de respiro (pedido do dono em 2026-11-23) | ? |
| Cartões | "fewer cards", evitar estética de dashboard | painéis de foto, grade de fotos, cartões de oferta | ? |
| Botão dourado | ouro "sempre contido" | ouro como botão primário (6,5:1 com forest) | manter |
| Hero | 100vh × 100vw, sem widget grande comprimindo | 100vh, busca em barra na base | manter |
| Ordem da home | Hero → prova social → motor → sobre → acomodações → experiências → galeria → reviews → datas | Hero → prova social → ofertas → faixa → reserva direta → galeria → trilha → zoom → acomodações → feriados → FAQ → chamada | conferir |

Até a decisão, trate `docs/design-system.md` como a direção de marca e este arquivo como a descrição do que o modelo implementa.

## 1. Princípios
1. **Reserva primeiro.** Toda tela tem um caminho claro para `/reservar` (botão dourado) e para o WhatsApp.
2. **Uma seção, uma ideia, uma tela.** No desktop cada seção cabe em no máximo 100vh e a página nunca passa da largura da tela (`.fit`). No celular o conteúdo empilha e rola.
3. **Um só sistema tipográfico.** Títulos sempre no par "caixa alta + itálico serifado"; nada de serifa Bodoni em seção nova.
4. **Foto honesta.** Cada quarto mostra a foto do próprio quarto (`getLocalRoomPhotos`). Legenda diz de onde é a foto.
5. **Movimento com propósito e com saída.** Toda animação respeita "reduzir movimento" e nada depende dela para o conteúdo aparecer.
6. **Rápido por padrão.** Servidor primeiro; animação (GSAP) só depois que a página fica ociosa.

## 2. Tokens

### Cores (marca)
| Token | Valor | Uso |
|---|---|---|
| `--brand-forest` | `#283223` | texto principal, fundos escuros, botão escuro |
| `--brand-gold` | `#bbb863` | botão primário, destaque, rótulos sobre escuro |
| `--brand-cream` | `#f5f5f5` | fundo de seções claras |
| `--brand-white` | `#ffffff` | cartões, fundo alternado |
| `--brand-black` | `#090909` | fundo de seções com foto (antes de carregar) |
| `--brand-whatsapp` | `#00e676` | botão do WhatsApp |
| dourado claro | `#efe3a0` | itálico e rótulos **sobre foto** (mais leitura) |

**Contraste (WCAG, calculado):** forest em branco 13,4:1 · forest em creme 12,3:1 · branco em forest 13,4:1 · forest em dourado (botão) 6,5:1 · dourado em forest 6,5:1 · dourado claro em forest 10,3:1. **Dourado em branco dá 2,1:1: só decorativo, nunca para texto.**

### Transparências
Cor com variável CSS **não aceita** o sufixo `/NN` do Tailwind (`bg-[color:var(--brand-forest)]/80` é ignorado e fica sem fundo). Use `rgba` literal: `bg-[rgba(40,50,35,0.82)]` (forest) e `rgba(187,184,99,α)` (dourado). Opacidades de Tailwind só em múltiplos de 5 (`/90`, não `/92`).

### Tipografia
| Papel | Fonte | Onde |
|---|---|---|
| Texto, interface | Inter (`--font-inter`) | todo o corpo |
| Títulos (display) | Bricolage Grotesque (`--font-bricolage`), caixa alta, peso 700, `letter-spacing: -0.025em`, `line-height: 0.92` | `.display` |
| Ênfase em título | Instrument Serif itálico (`--font-instrument`), caixa baixa | `<em>` dentro de `.display` |
| Legado | Bodoni Moda (`--font-playfair-display`) | só páginas antigas (`.font-hero-display`) |

Todas carregadas por `next/font` (hospedadas no próprio site).

Escala (sempre `clamp`, limitada também pela altura da tela):
- **H1 do hero:** `clamp(2.2rem, 5.4vw, 5rem)`
- **H2 de seção:** `clamp(1.9rem, min(4.6vw, 7vh), 3.8rem)` (constante `H2` em `HomeNovo.tsx`)
- **H2 de destaque** (zoom, chamada final): `clamp(2.2rem, min(5.6vw, 9vh), 4.8rem)`
- **Rótulo (eyebrow):** `.eyebrow`, 0,72 rem, caixa alta, `tracking 0.2em`, bolinha dourada
- **Corpo:** 1 rem / `leading-7` (1,1 rem em destaque); legendas 0,75–0,875 rem
- Texto sobre foto: classe `.onPhoto` (sombra) e dourado claro no itálico.

### Espaço e grade
- Container: `container` do Tailwind (centralizado, 2 rem de margem lateral, máx. 1400 px no `2xl`). **Nunca** sobrescrever com `max-w-[...] px-4` (desalinha a margem esquerda).
- Seções do desktop: `.fit` (altura 100svh) com `pt-[104px]` (compensa o menu fixo) e `pb-8`. Seção só com foto de fundo não precisa do `pt`.
- Ritmo de fundo: hero (foto) → branco (notas) → creme (ofertas) → ouro (faixa) → forest (reserva direta) → creme (galeria) → forest (trilha) → foto (zoom) → branco (acomodações) → creme (feriados, FAQ) → foto (chamada final).
- Vão entre blocos: 12–16 px em grades de foto; 20–24 px entre título e conteúdo.

### Movimento
- Curva padrão: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Entrada de elemento: 0,9 s, desloca 40 px; galeria entra em lote (`stagger 0.09`).
- Painéis que abrem (acomodações): 0,7 s. Foto em hover: `scale 1.05` em 0,7 s.
- Faixa de promessas: 38 s por volta, linear.
- **Fixar seção (pin):** registrar sempre na ordem em que aparecem na página (trilha, depois zoom), antes dos reveals. Fora de ordem aparece faixa em branco e seção sobreposta (bug real já corrigido).
- `prefers-reduced-motion`: sem animações, trilha vira rolagem lateral normal, tudo visível.

## 3. Componentes

### Botões
| Variante | Classes-chave | Uso |
|---|---|---|
| Primário (dourado) | `h-12 px-7 bg-[--brand-gold] text-[--brand-forest] text-sm font-bold uppercase tracking-[0.08em]`, `hover:opacity-90` | reservar / ver disponibilidade |
| Secundário (contorno) | `h-12 px-7 border border-white/50 text-white uppercase`, `hover:bg-white/10` | WhatsApp, conheça a pousada (sobre escuro) |
| Escuro | `bg-primary text-white` | cartões claros |
Todo botão que leva a `/reservar` ou ao WhatsApp usa `TrackedLink` (mede o clique).

### Rótulo + título (`.eyebrow` + `.display`)
Rótulo pequeno com bolinha, depois título em caixa alta com `<em>` na palavra de ênfase. Em fundo claro usar `.displayDark` (itálico em forest 78%).

### Galeria com foto ampliada (`PhotoGallery` + `PhotoLightbox`)
Grade 4 colunas × 3 linhas (desktop), 2 colunas (celular); fotos grandes ocupam 2 células. Clique abre a foto em alta qualidade com **legenda do lugar**, contador, setas, Esc para fechar e foco preso na janela. Tamanhos de imagem declarados (`sizes`) e `quality` 85.

### Trilha horizontal (`TrailCards`)
Cartões de foto + cartão final de chamada. No desktop a seção fica fixa e a rolagem vertical empurra os cartões para o lado; no celular é rolagem lateral nativa. Cada cartão amplia com a mesma janela.

### Acomodações (`RoomsAccordion`)
Quatro painéis que se abrem ao passar o mouse ou focar (desktop); lista completa no celular. Mostra foto do tipo de quarto, capacidade, itens e se aceita pets, com "Ver preços". Dados de pets vêm de `roomAcceptsPets`; fotos de `getLocalRoomPhotos`.

### Cartão de oferta (seção "Escolha sua acomodação")
Foto 16:10 com chip escuro "Ver fotos (N)", nome, capacidade, etiquetas dos itens, preço em destaque ("Total para N noite(s)") e botão. Preço fica **abaixo** da foto (leitura garantida).

### Outros
- **Faixa de promessas** (`.marquee`): ouro, texto forest, decorativa (`aria-hidden`).
- **FAQ:** `<details>` nativos + dados estruturados `FAQPage`.
- **Barra de busca do hero:** `SearchWidget` com `heroLayout="horizontal"`.
- **Botão fixo de reserva (celular):** `MobileBookingBar`. O cartão flutuante do desktop foi removido.

## 4. Acessibilidade (regras e estado)
Regras:
- Contraste mínimo 4,5:1 para texto normal e 3:1 para texto grande e controles. Texto pequeno de apoio nunca abaixo de 78% de opacidade do forest sobre branco.
- Nome acessível de botão/link **contém o texto visível** (ex.: "Ver fotos (42): Chalé"). Texto de dois `<span>` vizinhos precisa de espaço entre eles.
- Janela modal: `role="dialog"`, `aria-modal`, foco inicial no botão fechar, Tab circula, Esc fecha e devolve o foco.
- Alvos de toque ≥ 44×44 px nos controles principais.
- Imagem de conteúdo com `alt`; decorativa com `alt=""`.

Estado medido (2026-11-23), `axe-core` com regras WCAG 2.0/2.1 A e AA na home, desktop (1440×900) e celular (390×844): **0 violações** depois das correções (antes: contraste do rótulo "Total para" 3,8:1 e 4 nomes de botão que não continham o texto visível, todos corrigidos). Verificação automática pega só parte dos problemas.

Ainda **não verificado**: leitor de tela real (NVDA/VoiceOver), zoom de 200%, navegação só por teclado em todo o fluxo de reserva, `/reservar` e as páginas internas.

## 5. Lacunas conhecidas (próximos passos do design system)
1. Falta identidade própria: o estilo ainda empresta muito da Paraíso (par de fontes e grade). Definir paleta, par tipográfico e grade do Del Plata.
2. Hero em vídeo e fotos melhores (aguarda o material do Lucas / pasta de fotos).
3. Páginas internas (`/acomodacoes`, `/lazer`, `/restaurante`, `/contato`) ainda no layout antigo.
4. Transições entre páginas e microinterações.
5. Tokens ainda espalhados em Tailwind arbitrário; consolidar em variáveis CSS e componentes reutilizáveis.
6. Revisar `/reservar` e o admin com a mesma lista de acessibilidade.
