# Referências de sites de pousadas de serra (pesquisa de 2026-11-22)

Pesquisa feita abrindo o HTML de 11 sites reais (não agregadores) com `curl`. **Limites:** não renderizei JavaScript, não rodei Lighthouse e peso = HTML da home comprimido, sem imagens nem scripts. Nada aqui prova que o site "vende mais", só mostra o que cada um faz. O que não deu para ver está marcado "não verificado".

| # | Site (região) | Tecnologia | Motor de reservas | Conversão visível no HTML | HTML comprimido / TTFB |
|---|---|---|---|---|---|
| 1 | maplemonteverde.com.br (Monte Verde) | Cloudflare | não identificado, chat Asksuite | selo e FAQ "melhor tarifa sem comissão", WhatsApp, vídeo, TripAdvisor, schema LodgingBusiness + FAQPage | 18 KB / 0,47 s |
| 2 | pousadacariciadovento.com.br (Monte Verde) | Cloudflare | HSystem HBook | botão "Reservar" em ~21 pontos da página, WhatsApp, FAQ, 360 e vídeo, Pix | 130 KB / 0,64 s |
| 3 | estalagemdamontanha.com.br (Monte Verde) | Joomla, PHP 7.4 | Asksuite (chat) | pacotes, WhatsApp, 360, TripAdvisor | 321 KB sem compressão / 2,5 s (o mais lento) |
| 4 | serravillena.com.br (Monte Verde) | WordPress + Elementor | HSystem HBook | pacotes e feriados, Pix, parcelamento, WhatsApp, 360 | 44 KB / 1,3 s, mas 94 scripts e 104 imagens |
| 5 | pousadacanelagarden.com.br (Canela) | plataforma Innotel | motor embutido | "Reservar online" no título, "melhor tarifa", WhatsApp, 360, política de cancelamento | 113 KB sem compressão |
| 6 | stillogramado.com.br (Gramado) | WordPress + Elementor + WP Rocket | HSystem HBook e Omnibees | pacotes, parcelamento sem juros, Pix, FAQ, 360, WhatsApp | 78 KB / 0,73 s |
| 7 | nacionalinn.com.br, Victoria Villa (Campos do Jordão) | site próprio | Letsbook | "a partir de" (15 ocorrências), feriados, pacotes, 360, TripAdvisor | 88 KB / 0,25 s, imagens com lazy loading |
| 8 | serranegrapousada.com.br, Refúgio (Serra Negra) | WordPress | Bukly | WhatsApp, página de tarifas com calendário | 15 KB / 0,71 s |
| 9 | pousadadasaguasserranegra.com.br (Serra Negra) | Hostinger | não identificado | WhatsApp, FAQ, Pix, parcelamento | 78 KB / 0,66 s |
| 10 | pousadaaguasdelindoia.com.br (Águas de Lindóia) | SPA (conteúdo por JavaScript) | não verificado | não verificado | não medido |
| 11 | pousadaspadonramon.com.br (Gramado/Canela) | Wix | HSystem HBook | pacotes, Pix, 360, feriados | 1,75 MB só de HTML sem compressão |

Não consegui abrir sites de Penedo, Visconde de Mauá, Itatiaia, Petrópolis e Holambra (a busca só devolveu agregadores).

## Onde o botão/link do motor de reservas aparece
- **Topo da página, fixo** ("Reservar" no menu), no hero e **repetido em cada seção** (a Carícia do Vento chama o motor em ~21 pontos).
- **Em cada acomodação e pacote** ("Ver preços", "Reservar este quarto"), não só na busca do topo.
- **Barra fixa no celular** e WhatsApp flutuante com mensagem pronta.
- **"A partir de R$ X" por quarto/noite** nas vitrines (Nacional Inn).
- **Selo de reserva direta** perto da busca e do resumo ("melhor tarifa, sem comissão").
- **Páginas de feriado/pacote** com preço e mínimo de diárias (Nacional Inn, Stillo, Serra Villena, Castelo de Ramon).

## O que o Del Plata tem de vantagem
Nenhum dos sites abertos é Next.js com motor próprio: a maioria é WordPress/Elementor, Joomla ou Wix mais um motor externo (HSystem HBook é o mais comum). O Del Plata, com motor próprio e disponibilidade do Hospedin, já tem fluxo único e pode ser mais rápido (Serra Villena carrega 94 scripts; Estalagem leva 2,5 s de resposta; Castelo de Ramon tem 1,75 MB de HTML).

## Lista priorizada (esforço / impacto em vendas)
1. Selo "reserva direta" com um benefício real (precisa de decisão do dono) — baixo / alto.
2. Botão de reservar fixo e repetido ao longo da página — baixo / alto.
3. WhatsApp flutuante com datas e quarto já preenchidos — baixo / alto.
4. Preço "a partir de" por acomodação — médio / alto.
5. Página de feriados e pacotes com preço — médio / alto.
6. Depoimentos reais perto do botão (as notas Google/Booking/Tripadvisor já existem) — baixo / alto.
7. Texto de Pix e parcelamento antes do pagamento — baixo / médio-alto.
8. Política de cancelamento e de pets claras (FAQ) — baixo / médio.
9. JSON-LD LodgingBusiness + FAQPage — baixo / médio.
10. Vídeo curto ou tour 360 (carregado sob demanda) — médio / médio.
11. FAQ real — baixo / médio.
12. Manter a vantagem de velocidade: poucas dependências de terceiros — médio / médio.
