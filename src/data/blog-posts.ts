import { BlogCategory, BlogPost } from "@/types/blog";

export const blogCategories: BlogCategory[] = [
  {
    slug: "o-que-fazer",
    label: "O que fazer em Serra Negra",
    shortLabel: "O que fazer",
    description:
      "Roteiros e sugestões práticas para aproveitar melhor o tempo em Serra Negra.",
  },
  {
    slug: "onde-ficar",
    label: "Onde ficar em Serra Negra",
    shortLabel: "Onde ficar",
    description:
      "Critérios objetivos para escolher a hospedagem de acordo com o tipo de viagem.",
  },
  {
    slug: "dicas-de-viagem",
    label: "Dicas de viagem e hospedagem",
    shortLabel: "Dicas de viagem",
    description:
      "Dicas diretas para organizar a viagem, evitar erros comuns e chegar melhor preparado.",
  },
  {
    slug: "delplata",
    label: "Pousada Delplata",
    shortLabel: "A pousada",
    description:
      "Informações práticas sobre a pousada para quem quer conhecer melhor a hospedagem.",
  },
  {
    slug: "guias-sazonais",
    label: "Guias sazonais e feriados",
    shortLabel: "Sazonais",
    description:
      "Conteúdos para decidir a melhor época da viagem, incluindo feriados e períodos mais procurados.",
  },
];

export const blogPosts: BlogPost[] = [
  {
    slug: "eventos-em-serra-negra-em-2026",
    title: "Eventos em Serra Negra em 2026: o que já está confirmado",
    excerpt:
      "Um panorama direto dos eventos de Serra Negra em 2026, com base nas publicações oficiais da Prefeitura.",
    summary:
      "Um guia curto para separar o que já passou do que ainda vale acompanhar em 2026.",
    publishedAt: "2026-06-08",
    updatedAt: "2026-06-08",
    readingTime: "6 min",
    category: "guias-sazonais",
    tags: ["eventos", "Serra Negra", "2026", "festival", "feriados"],
    coverImage: {
      src: "/fotos/piscina-chale/DJI_0918.jpg",
      alt: "Vista de Serra Negra em período de evento",
    },
    seo: {
      title: "Eventos em Serra Negra em 2026 | O que já está confirmado",
      description:
        "Veja quais eventos de Serra Negra já foram confirmados oficialmente em 2026 e como isso pode impactar a sua hospedagem e o planejamento da viagem.",
    },
    featured: false,
    seedDemo: true,
    funnelStage: "topo",
    content: [
      {
        type: "paragraph",
        content:
          "Quem pretende viajar para Serra Negra em 2026 já consegue se orientar pelo calendário oficial da Prefeitura. Em 8 de junho de 2026, parte desses eventos já aconteceu e outra parte ainda está por vir. Separar isso evita confusão no planejamento.",
      },
      {
        type: "heading",
        content: "O que já passou em 2026",
      },
      {
        type: "image",
        src: "/fotos/jardim-aptos/DJI_0903.jpg",
        alt: "Vista geral da pousada e da atmosfera de Serra Negra",
        caption: "Ao longo do ano, o calendário de eventos muda o ritmo da cidade e a antecedência ideal para reservar.",
      },
      {
        type: "list",
        items: [
          "Festival de Verão 2026: de 2 de janeiro a 1º de fevereiro.",
          "Carnaval Serra Alegria 2026: de 13 a 17 de fevereiro.",
          "Festa das Nações 2026: de 1º a 3 de maio.",
          "Festival do Café & Riquezas da Serra: de 22 a 24 de maio.",
        ],
      },
      {
        type: "heading",
        content: "O que ainda vale acompanhar",
      },
      {
        type: "list",
        items: [
          "Festival de Inverno Serra Negra In Concert 2026: de 19 de junho a 26 de julho.",
        ],
      },
      {
        type: "heading",
        content: "O segundo semestre no radar",
      },
      {
        type: "image",
        src: "/fotos/piscina-chale/DJI_0917.jpg",
        alt: "Área externa da pousada em período propício para viagem",
      },
      {
        type: "paragraph",
        content:
          "A página oficial de eventos anuais também sinaliza períodos importantes do segundo semestre, mesmo antes da programação completa sair. Depois de 8 de junho de 2026, vale acompanhar o Desafio do Morro do Cristo em agosto, a Festa D’Itália e o aniversário da cidade em setembro, ações de outubro, o Acender das Luzes e o Natal Luzes da Serra em novembro, além de Natal e Réveillon em dezembro.",
      },
      {
        type: "heading",
        content: "O que isso muda na hospedagem",
      },
      {
        type: "list",
        items: [
          "Eventos gastronômicos e culturais costumam aumentar a procura por fins de semana específicos.",
          "Festival de Inverno e feriados prolongados normalmente exigem mais antecedência para escolher melhor a acomodação.",
          "Quando a programação ainda não saiu completa, vale monitorar os canais oficiais antes de fechar a viagem por impulso.",
        ],
      },
      {
        type: "paragraph",
        content:
          "Se a ideia é pegar a cidade mais ativa, essas datas funcionam bem. Se a prioridade for descanso, costuma fazer mais sentido buscar semanas fora dos eventos principais.",
      },
    ],
  },
  {
    slug: "o-que-fazer-em-serra-negra-em-um-fim-de-semana",
    title: "O que fazer em Serra Negra em um fim de semana",
    excerpt:
      "Um roteiro simples para dois dias em Serra Negra, com centro, teleférico e tempo para descansar.",
    summary:
      "Um roteiro direto para aproveitar a viagem sem transformar o fim de semana em correria.",
    publishedAt: "2026-03-12",
    updatedAt: "2026-03-19",
    readingTime: "6 min",
    category: "o-que-fazer",
    tags: ["Serra Negra", "fim de semana", "roteiro", "planejamento"],
    coverImage: {
      src: "/fotos/piscina-aptos/DJI_0908.jpg",
      alt: "Área externa da Pousada Delplata em Serra Negra",
    },
    seo: {
      title: "O que fazer em Serra Negra em um fim de semana | Blog Delplata",
      description:
        "Veja um roteiro prático para passar um fim de semana em Serra Negra com passeios centrais, compras, teleférico e tempo para descansar.",
    },
    featured: true,
    seedDemo: true,
    funnelStage: "topo",
    content: [
      {
        type: "paragraph",
        content:
          "Em uma viagem curta, o melhor roteiro é o que combina centro, um ou dois passeios clássicos e tempo para descansar. Tentar encaixar tudo no mesmo fim de semana costuma deixar a experiência corrida.",
      },
      {
        type: "heading",
        content: "Em dois dias, priorize isso",
      },
      {
        type: "image",
        src: "/fotos/jardim-aptos/DSC_0262.jpg",
        alt: "Jardins da pousada para estadia de fim de semana em Serra Negra",
        caption: "Em um roteiro curto, descanso e deslocamentos simples pesam tanto quanto os passeios.",
      },
      {
        type: "paragraph",
        content:
          "Para um fim de semana, vale concentrar o roteiro no que é simples de encaixar: centro, compras, teleférico, uma passada pelo fontanário e uma refeição sem pressa. Se sobrar tempo, dá para incluir um café ou uma fazenda da região.",
      },
      {
        type: "list",
        items: [
          "Centro e comércio de malhas para caminhar, ver vitrines e sentir o ritmo da cidade.",
          "Teleférico para ter uma vista melhor da região e encaixar um passeio clássico da viagem.",
          "Fontanário e arredores para um trecho mais tranquilo entre uma atividade e outra.",
          "Tempo livre na hospedagem para piscina, café e descanso sem transformar a viagem em maratona.",
        ],
      },
      {
        type: "heading",
        content: "Um roteiro que funciona",
      },
      {
        type: "image",
        src: "/fotos/piscina-aptos/DJI_0908.jpg",
        alt: "Vista da pousada para um fim de semana em Serra Negra",
      },
      {
        type: "paragraph",
        content:
          "No sábado, faz sentido começar pelo centro e deixar o teleférico ou o passeio principal para o mesmo dia. No domingo, o melhor costuma ser desacelerar: café com calma, uma última volta e saída sem correria.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Chegue, faça o check-in e use o restante do primeiro dia para uma volta leve pelo centro.",
          "Concentre o passeio principal no segundo período da viagem, quando o ritmo já estiver ajustado.",
          "Deixe a manhã de saída livre para café, malas e uma última parada sem pressa.",
        ],
      },
      {
        type: "heading",
        content: "Onde a hospedagem pesa",
      },
      {
        type: "paragraph",
        content:
          "Em uma viagem curta, a hospedagem precisa facilitar o fim de semana. Café da manhã resolvido, quarto confortável e uma base tranquila fazem diferença. Antes de reservar, vale checar o tipo de acomodação e o ritmo da pousada.",
      },
    ],
  },
  {
    slug: "onde-ficar-em-serra-negra",
    title: "Onde ficar em Serra Negra",
    excerpt:
      "O ponto principal não é só preço: veja como escolher entre centro, áreas mais calmas e tipo de hospedagem.",
    summary:
      "Um guia prático para alinhar a hospedagem ao ritmo real da viagem.",
    publishedAt: "2026-03-10",
    updatedAt: "2026-03-19",
    readingTime: "5 min",
    category: "onde-ficar",
    tags: ["onde ficar", "hospedagem", "Serra Negra", "reserva"],
    coverImage: {
      src: "/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp",
      alt: "Acomodação da Pousada Delplata",
    },
    seo: {
      title: "Onde ficar em Serra Negra | Como escolher a hospedagem",
      description:
        "Veja o que realmente importa na hora de escolher onde ficar em Serra Negra: localização, tipo de hospedagem e perfil da viagem.",
    },
    seedDemo: true,
    funnelStage: "meio",
    content: [
      {
        type: "paragraph",
        content:
          "Escolher onde ficar em Serra Negra começa com uma pergunta simples: você quer fazer mais coisas a pé no centro ou prefere uma hospedagem mais tranquila para descansar? Essa resposta costuma pesar mais do que qualquer lista genérica de vantagens.",
      },
      {
        type: "heading",
        content: "Antes de reservar, compare isso",
      },
      {
        type: "image",
        src: "/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp",
        alt: "Apartamento da ala principal da pousada",
        caption: "Ver fotos reais da hospedagem ajuda mais do que listas genéricas de vantagens.",
      },
      {
        type: "list",
        items: [
          "Distância prática do que você pretende fazer: centro, compras, passeio curto ou descanso.",
          "Tipo de viagem: casal, família, viagem rápida ou dias mais tranquilos.",
          "Estrutura da hospedagem: café da manhã, área de lazer, estacionamento e perfil dos quartos.",
          "Facilidade para tirar dúvidas antes de fechar a reserva, principalmente em datas disputadas.",
        ],
      },
      {
        type: "heading",
        content: "Centro ou uma área mais calma?",
      },
      {
        type: "image",
        src: "/fotos/jardim-aptos/DJI_0889.jpg",
        alt: "Área verde da pousada em ambiente mais tranquilo",
      },
      {
        type: "paragraph",
        content:
          "Quem quer circular pelo comércio e sair para comer com menos carro costuma procurar hospedagem mais próxima do centro. Já quem prioriza silêncio, descanso e tempo na própria pousada tende a aproveitar melhor uma área mais tranquila.",
      },
      {
        type: "heading",
        content: "Quando a pousada entrega mais valor",
      },
      {
        type: "paragraph",
        content:
          "Para viagens de lazer, casal ou família, a pousada costuma funcionar melhor quando atendimento próximo, ambiente tranquilo e ritmo menos impessoal pesam na escolha. Antes de decidir, vale olhar fotos reais e entender bem as categorias de quarto.",
      },
    ],
  },
  {
    slug: "pousada-ou-hotel-em-serra-negra",
    title: "Pousada ou hotel em Serra Negra: o que vale mais a pena",
    excerpt:
      "Uma comparação direta para escolher melhor a hospedagem, sem argumento genérico.",
    summary:
      "Um comparativo curto para entender qual formato combina mais com o seu ritmo de viagem.",
    publishedAt: "2026-03-08",
    updatedAt: "2026-03-19",
    readingTime: "6 min",
    category: "dicas-de-viagem",
    tags: ["pousada", "hotel", "comparativo", "Serra Negra"],
    coverImage: {
      src: "/fotos/ala-chales/chales/IMG_0125-1200.webp",
      alt: "Área de hospedagem da Pousada Delplata",
    },
    seo: {
      title: "Pousada ou hotel em Serra Negra: o que vale mais a pena",
      description:
        "Compare pousada e hotel em Serra Negra com foco no tipo de experiência, no ritmo da viagem e no que realmente importa na reserva.",
    },
    seedDemo: true,
    funnelStage: "meio",
    content: [
      {
        type: "paragraph",
        content:
          "Nem toda comparação entre pousada e hotel precisa virar disputa genérica. O que faz sentido depende do tipo de experiência, do tempo disponível e do nível de praticidade esperado na estadia.",
      },
      {
        type: "heading",
        content: "Quando hotel faz mais sentido",
      },
      {
        type: "image",
        src: "/fotos/ala-chales/chales/IMG_0125-1200.webp",
        alt: "Ala de hospedagem da pousada em Serra Negra",
      },
      {
        type: "list",
        items: [
          "Quando o viajante prioriza uma operação mais padronizada.",
          "Quando a viagem tem foco mais funcional do que experiencial.",
          "Quando o principal critério é comparar estrutura em escala.",
        ],
      },
      {
        type: "heading",
        content: "Quando a pousada costuma ganhar",
      },
      {
        type: "image",
        src: "/fotos/restaurante/DSC_0056.jpg",
        alt: "Café da manhã da pousada em Serra Negra",
        caption: "Hospitalidade, café da manhã e ritmo de estadia contam mais do que comparação abstrata.",
      },
      {
        type: "list",
        items: [
          "Quando o viajante busca ambiente mais acolhedor e ritmo menos impessoal.",
          "Quando a viagem pede descanso e percepção clara de cuidado.",
          "Quando o canal direto de atendimento faz diferença antes da reserva.",
        ],
      },
    ],
  },
  {
    slug: "quando-visitar-serra-negra",
    title: "Quando visitar Serra Negra",
    excerpt:
      "Como escolher a melhor época para viajar considerando eventos, ritmo da cidade e tipo de estadia.",
    summary:
      "Um ponto de partida para escolher a data da viagem com mais clareza.",
    publishedAt: "2026-03-06",
    updatedAt: "2026-06-08",
    readingTime: "5 min",
    category: "guias-sazonais",
    tags: ["quando ir", "Serra Negra", "planejamento", "viagem"],
    coverImage: {
      src: "/fotos/jardim-aptos/DSC_0258.jpg",
      alt: "Jardins e área verde da Pousada Delplata",
    },
    seo: {
      title: "Quando visitar Serra Negra | Guia prático de planejamento",
      description:
        "Descubra como escolher a melhor época para visitar Serra Negra de acordo com o estilo da viagem e a experiência de hospedagem desejada.",
    },
    seedDemo: true,
    funnelStage: "topo",
    content: [
      {
        type: "paragraph",
        content:
          "A melhor época para visitar Serra Negra depende mais do perfil da viagem do que de uma resposta única. Algumas pessoas preferem cidade mais ativa; outras valorizam estadia mais calma, com foco em descanso.",
      },
      {
        type: "paragraph",
        content:
          "Em 2026, isso fica mais claro olhando o calendário oficial: o primeiro semestre já teve Festival de Verão, Carnaval Serra Alegria, Festa das Nações e Festival do Café. O Festival de Inverno está confirmado de 19 de junho a 26 de julho. Esses períodos mudam a energia da cidade e a antecedência ideal para reservar.",
      },
      {
        type: "heading",
        content: "Antes de escolher a data",
      },
      {
        type: "image",
        src: "/fotos/jardim-aptos/DSC_0258.jpg",
        alt: "Jardins da pousada em uma época mais tranquila do ano",
      },
      {
        type: "list",
        items: [
          "Se a prioridade é descanso ou uma agenda mais cheia.",
          "Se a viagem será em casal, em família ou em um feriado curto.",
          "Se a ideia é pegar a cidade mais movimentada ou um período mais tranquilo.",
          "Se existe algum evento oficial acontecendo na data desejada.",
        ],
      },
      {
        type: "heading",
        content: "Quando a cidade ganha mais movimento",
      },
      {
        type: "image",
        src: "/fotos/piscina-chale/DJI_0918.jpg",
        alt: "Vista da pousada em período de maior movimento turístico",
      },
      {
        type: "paragraph",
        content:
          "Em geral, períodos de festival, feriado prolongado e inverno aumentam o fluxo de visitantes. Em Serra Negra, isso aparece com mais força no Festival de Inverno, em eventos gastronômicos e nos feriados do segundo semestre. Para quem quer cidade ativa, essas datas podem ser ótimas. Para quem quer silêncio, exigem mais critério.",
      },
      {
        type: "paragraph",
        content:
          "Conteúdo sazonal não precisa prometer a data perfeita. Ele precisa ajudar a entender o equilíbrio entre movimento, preço, disponibilidade e tipo de experiência. A forma mais segura de planejar é cruzar o ritmo da viagem com o calendário oficial da cidade.",
      },
    ],
  },
  {
    slug: "pousada-delplata-em-serra-negra",
    title: "Pousada Delplata em Serra Negra",
    excerpt:
      "Um resumo objetivo da proposta da Delplata para quem já está perto da decisão de reservar.",
    summary:
      "Um retrato mais direto da hospedagem para quem quer entender a proposta da Delplata.",
    publishedAt: "2026-03-05",
    updatedAt: "2026-03-19",
    readingTime: "4 min",
    category: "delplata",
    tags: ["Delplata", "hospedagem", "pousada", "Serra Negra"],
    coverImage: {
      src: "/fotos/piscina-aptos/DJI_0845.jpg",
      alt: "Piscina da Pousada Delplata em Serra Negra",
    },
    seo: {
      title: "Pousada Delplata em Serra Negra | Conheça a hospedagem",
      description:
        "Veja um resumo claro da proposta da Pousada Delplata em Serra Negra e entenda se a hospedagem combina com a sua viagem.",
    },
    seedDemo: true,
    funnelStage: "fundo",
    content: [
      {
        type: "paragraph",
        content:
          "A Pousada Delplata se apresenta como uma hospedagem familiar em Serra Negra, com foco em conforto, tranquilidade e uma experiência mais acolhedora. O site destaca natureza, café da manhã diário, área de lazer com piscina e acomodações para perfis diferentes de estadia.",
      },
      {
        type: "heading",
        content: "O que já está claro na proposta",
      },
      {
        type: "image",
        src: "/fotos/piscina-aptos/DJI_0845.jpg",
        alt: "Piscina e área externa da Pousada Delplata",
        caption: "A proposta da Delplata mistura descanso, lazer e uma leitura mais familiar da hospedagem.",
      },
      {
        type: "list",
        items: [
          "Hospedagem em Serra Negra com proposta familiar.",
          "Área de lazer com piscina adulto e infantil.",
          "Café da manhã diário em ambiente agradável.",
          "Acomodações em diferentes alas, com foco em conforto e descanso.",
          "Atendimento por WhatsApp para tirar dúvidas sobre a hospedagem.",
        ],
      },
      {
        type: "heading",
        content: "Para quem a Delplata faz mais sentido",
      },
      {
        type: "image",
        src: "/fotos/restaurante/IMG_0025.webp",
        alt: "Ambiente de café da manhã da pousada",
      },
      {
        type: "paragraph",
        content:
          "Esse conteúdo faz mais sentido para quem já decidiu viajar para Serra Negra e quer entender se a Delplata combina com o estilo da estadia. A função dele é mostrar a proposta da pousada com clareza, sem exagero.",
      },
    ],
  },
];
