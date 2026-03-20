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
    slug: "o-que-fazer-em-serra-negra-em-um-fim-de-semana",
    title: "O que fazer em Serra Negra em um fim de semana",
    excerpt:
      "Um roteiro simples para aproveitar Serra Negra em dois dias, com centro, teleférico, compras e tempo para descansar.",
    summary:
      "Um resumo prático para quem quer montar o fim de semana sem perder tempo com deslocamentos e escolhas vagas.",
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
          "Se a viagem for curta, o melhor roteiro em Serra Negra é o que combina passeio pelo centro, uma ou duas paradas clássicas da cidade e tempo livre para descansar. Tentar encaixar tudo no mesmo fim de semana costuma deixar a experiência mais corrida do que agradável.",
      },
      {
        type: "heading",
        content: "O que vale priorizar em dois dias",
      },
      {
        type: "paragraph",
        content:
          "Para um fim de semana, faz sentido concentrar o roteiro no que Serra Negra tem de mais fácil de encaixar no tempo curto: passeio pelo centro, compras de malhas, teleférico, uma passada pelo fontanário e uma refeição sem pressa. Se houver mais tempo, dá para incluir um café ou visita em fazendas da região.",
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
        content: "Uma sugestão simples de roteiro",
      },
      {
        type: "paragraph",
        content:
          "No sábado, a melhor lógica costuma ser começar pelo centro e deixar o teleférico ou outro passeio principal para o mesmo dia. No domingo, vale desacelerar: café da manhã com calma, uma última volta pela cidade e saída sem correria. Esse formato funciona melhor para quem quer conhecer Serra Negra sem voltar para casa cansado.",
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
        content: "Onde a hospedagem entra nessa decisão",
      },
      {
        type: "paragraph",
        content:
          "Em uma viagem curta, a hospedagem precisa facilitar o fim de semana. Café da manhã resolvido, quarto confortável e uma base tranquila fazem diferença, principalmente quando a ideia é alternar passeio com descanso. Antes de reservar, vale checar o tipo de acomodação, a proposta da pousada e se o ritmo do lugar combina com o tipo de viagem que você quer fazer.",
      },
    ],
  },
  {
    slug: "onde-ficar-em-serra-negra",
    title: "Onde ficar em Serra Negra",
    excerpt:
      "O ponto principal não é só preço: veja o que comparar entre centro, áreas mais tranquilas e tipo de hospedagem.",
    summary:
      "Um guia direto para escolher melhor a hospedagem e evitar reserva desalinhada com o estilo da viagem.",
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
          "Escolher onde ficar em Serra Negra passa por uma pergunta simples: você quer fazer a maior parte das coisas a pé no centro ou prefere uma hospedagem mais tranquila para descansar? Essa resposta costuma definir melhor a reserva do que qualquer lista genérica de vantagens.",
      },
      {
        type: "heading",
        content: "O que comparar antes de reservar",
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
        content: "Ficar perto do centro ou em uma área mais calma?",
      },
      {
        type: "paragraph",
        content:
          "Quem quer circular pelo comércio, passear no centro e sair para comer sem depender tanto do carro costuma procurar hospedagem mais próxima da área central. Já quem prioriza silêncio, descanso e tempo na própria pousada tende a aproveitar melhor uma hospedagem em área mais tranquila, desde que o acesso para a cidade siga simples.",
      },
      {
        type: "heading",
        content: "Quando a pousada costuma valer mais a pena",
      },
      {
        type: "paragraph",
        content:
          "Para viagens de lazer, casal ou família, a pousada costuma funcionar bem quando o atendimento mais próximo, o ambiente tranquilo e o ritmo menos impessoal pesam na escolha. Antes de decidir, vale olhar fotos reais, entender a diferença entre categorias de quarto e confirmar se a proposta do lugar combina com o que você espera da viagem.",
      },
    ],
  },
  {
    slug: "pousada-ou-hotel-em-serra-negra",
    title: "Pousada ou hotel em Serra Negra: o que vale mais a pena",
    excerpt:
      "Uma comparação direta para quem quer escolher a hospedagem certa sem depender de argumentos genéricos.",
    summary:
      "Comparação direta para entender qual tipo de hospedagem combina mais com o seu ritmo de viagem.",
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
          "Nem toda comparação entre pousada e hotel precisa virar disputa genérica. O que faz sentido para uma viagem depende do tipo de experiência que a pessoa quer viver, do tempo disponível e do nível de praticidade esperado durante a estadia.",
      },
      {
        type: "heading",
        content: "Quando um hotel pode ser a melhor escolha",
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
        content: "Quando uma pousada tende a entregar mais valor",
      },
      {
        type: "list",
        items: [
          "Quando o viajante busca ambiente mais acolhedor e ritmo menos impessoal.",
          "Quando a viagem pede descanso e percepção clara de cuidado.",
          "Quando o canal direto de atendimento faz diferença antes da reserva.",
        ],
      },
      {
        type: "callout",
        title: "Dica prática",
        content:
          "Antes de reservar, compare menos promessas e mais contexto: localização, tipo de quarto, café da manhã, rotina da viagem e perfil de atendimento.",
      },
    ],
  },
  {
    slug: "quando-visitar-serra-negra",
    title: "Quando visitar Serra Negra",
    excerpt:
      "Como pensar a melhor época para viajar considerando clima, ritmo de viagem e perfil de hospedagem.",
    summary:
      "Um ponto de partida para decidir a época da viagem com base no ritmo que você procura.",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-19",
    readingTime: "4 min",
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
          "A melhor época para visitar Serra Negra depende menos de uma resposta universal e mais do perfil da viagem. Algumas pessoas preferem períodos mais movimentados, com cidade mais ativa. Outras valorizam uma estadia mais calma, com foco maior em descanso.",
      },
      {
        type: "heading",
        content: "O que considerar antes de escolher a data",
      },
      {
        type: "list",
        items: [
          "Se a prioridade é descanso ou uma agenda mais cheia.",
          "Se a viagem será em casal, em família ou em um feriado curto.",
          "Se a ideia é pegar a cidade mais movimentada ou um período mais tranquilo.",
        ],
      },
      {
        type: "paragraph",
        content:
          "Conteúdo sazonal bem feito não precisa prometer a data perfeita. Ele deve ajudar a pessoa a entender o trade-off entre movimento, clima percebido, preço, disponibilidade e tipo de experiência.",
      },
    ],
  },
  {
    slug: "pousada-delplata-em-serra-negra",
    title: "Pousada Delplata em Serra Negra",
    excerpt:
      "Um resumo objetivo da proposta de hospedagem da Delplata para quem já está perto da decisão de reservar.",
    summary:
      "Um resumo direto da hospedagem para quem quer entender melhor a proposta da Delplata.",
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
          "A Pousada Delplata se apresenta como uma hospedagem familiar em Serra Negra, com foco em conforto, tranquilidade e uma experiência mais acolhedora. No site atual, a pousada destaca ambiente rodeado de natureza, café da manhã diário, área de lazer com piscina e opções de acomodação para diferentes perfis de estadia.",
      },
      {
        type: "heading",
        content: "O que já está confirmado no site",
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
        content: "Para quem esse conteúdo funciona melhor",
      },
      {
        type: "paragraph",
        content:
          "Essa página faz mais sentido para quem já decidiu viajar para Serra Negra e quer entender se a Delplata combina com o estilo da estadia. A função dela é mostrar a proposta da pousada com clareza, sem exagero e sem promessa vaga.",
      },
    ],
  },
];
