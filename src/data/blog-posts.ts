import { BlogCategory, BlogPost } from "@/types/blog";

export const blogCategories: BlogCategory[] = [
  {
    slug: "o-que-fazer",
    label: "O que fazer em Serra Negra",
    shortLabel: "O que fazer",
    description:
      "Conteúdos para quem ainda está planejando o roteiro e quer entender como aproveitar a cidade.",
  },
  {
    slug: "onde-ficar",
    label: "Onde ficar em Serra Negra",
    shortLabel: "Onde ficar",
    description:
      "Guias comparativos para ajudar a escolher a hospedagem certa de acordo com o perfil da viagem.",
  },
  {
    slug: "dicas-de-viagem",
    label: "Dicas de viagem e hospedagem",
    shortLabel: "Dicas de viagem",
    description:
      "Conteúdo prático para organizar a viagem com mais clareza e menos atrito na decisão.",
  },
  {
    slug: "delplata",
    label: "Conteúdos sobre a Delplata",
    shortLabel: "Delplata",
    description:
      "Páginas de intenção comercial ligadas diretamente à pousada e à reserva direta.",
  },
  {
    slug: "guias-sazonais",
    label: "Guias sazonais e feriados",
    shortLabel: "Sazonais",
    description:
      "Estrutura pronta para temas sazonais, feriados e momentos de alta intenção de viagem.",
  },
];

export const blogPosts: BlogPost[] = [
  {
    slug: "o-que-fazer-em-serra-negra-em-um-fim-de-semana",
    title: "O que fazer em Serra Negra em um fim de semana",
    excerpt:
      "Um guia enxuto para organizar a viagem em Serra Negra sem exageros, com foco em ritmo, conforto e boa hospedagem.",
    summary:
      "Estrutura editorial pronta para um conteúdo de topo de funil sobre Serra Negra, com orientações úteis e pontos que ainda precisam de validação local antes da publicação final.",
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
        "Veja como estruturar um fim de semana em Serra Negra com mais clareza, sem correria e com hospedagem alinhada ao seu ritmo de viagem.",
    },
    featured: true,
    seedDemo: true,
    funnelStage: "topo",
    content: [
      {
        type: "callout",
        title: "Conteúdo seed/demo",
        content:
          "Esta peça foi criada para estruturar o blog e demonstrar a futura linha editorial. Antes de publicar como conteúdo definitivo, valide atrações, horários, eventos e distâncias com fontes internas ou oficiais.",
      },
      {
        type: "paragraph",
        content:
          "Quem pesquisa Serra Negra para um fim de semana geralmente quer uma resposta prática: o que priorizar, como dividir o tempo e onde vale a pena se hospedar para reduzir deslocamentos desnecessários. O melhor conteúdo para essa busca precisa ser objetivo e útil, sem virar uma lista genérica de atrações.",
      },
      {
        type: "heading",
        content: "Comece pela lógica da viagem, não pela lista de lugares",
      },
      {
        type: "paragraph",
        content:
          "Antes de montar o roteiro, vale definir qual é a intenção principal da viagem. Para algumas pessoas, a prioridade é descansar. Para outras, é circular pela cidade, conhecer o comércio local, sair para comer ou aproveitar a região em casal. Essa definição muda completamente a melhor escolha de hospedagem e o formato ideal do fim de semana.",
      },
      {
        type: "list",
        items: [
          "Se a prioridade for descanso, a hospedagem precisa entregar conforto e ambiente tranquilo.",
          "Se a prioridade for mobilidade, vale olhar com atenção o ponto de apoio da viagem.",
          "Se a viagem for curta, concentrar decisões evita perder tempo com deslocamentos e remarcações.",
        ],
      },
      {
        type: "heading",
        content: "Uma estrutura simples para organizar o fim de semana",
      },
      {
        type: "paragraph",
        content:
          "Um bom guia de Serra Negra pode sugerir uma divisão simples entre chegada, exploração leve e momentos de descanso. Não é preciso prometer um roteiro fechado. O que ajuda de verdade é orientar o visitante sobre como distribuir a energia da viagem entre manhã, tarde e noite.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Chegada: priorize check-in tranquilo e reserve o restante do dia para adaptação.",
          "Dia principal: concentre a maior parte do roteiro quando já estiver descansado.",
          "Saída: deixe a manhã final mais leve para evitar sensação de correria.",
        ],
      },
      {
        type: "heading",
        content: "A hospedagem influencia o aproveitamento do roteiro",
      },
      {
        type: "paragraph",
        content:
          "Mesmo em um conteúdo de topo de funil, a hospedagem precisa aparecer como parte da solução. Quem pretende viajar por pouco tempo costuma valorizar praticidade, café da manhã resolvido, ambiente agradável e uma base que permita alternar passeio com descanso sem fricção.",
      },
      {
        type: "callout",
        title: "Ponto editorial para versão final",
        content:
          "Na etapa de conteúdo definitivo, este post pode ganhar uma seção validada com atrações reais, agenda sazonal, roteiro por perfil de viagem e links internos para páginas comerciais do site.",
      },
    ],
  },
  {
    slug: "onde-ficar-em-serra-negra",
    title: "Onde ficar em Serra Negra",
    excerpt:
      "O que realmente comparar na hora de escolher hospedagem em Serra Negra: perfil da viagem, localização funcional e experiência desejada.",
    summary:
      "Conteúdo de meio de funil pensado para transformar uma busca ampla em critérios claros de decisão.",
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
        "Entenda quais critérios realmente importam para escolher onde ficar em Serra Negra sem cair em comparações superficiais.",
    },
    seedDemo: true,
    funnelStage: "meio",
    content: [
      {
        type: "callout",
        title: "Conteúdo seed/demo",
        content:
          "Estrutura criada para o novo blog. Pode ser publicada depois de completar detalhes locais e exemplos validados sobre bairros, deslocamentos e sazonalidade.",
      },
      {
        type: "paragraph",
        content:
          "A busca por onde ficar em Serra Negra raramente é apenas sobre preço. Em geral, ela envolve contexto: quem vai viajar, quanto tempo a pessoa terá na cidade, se a prioridade é descanso ou circulação e qual nível de praticidade faz diferença na experiência.",
      },
      {
        type: "heading",
        content: "Os critérios que mais pesam na decisão",
      },
      {
        type: "list",
        items: [
          "Perfil da viagem: casal, família, viagem curta ou estadia mais tranquila.",
          "Conforto da hospedagem: quarto, estrutura, café da manhã e sensação geral de cuidado.",
          "Localização funcional: facilidade para entrar, sair e montar o roteiro sem excesso de deslocamento.",
          "Canal de reserva: facilidade para reservar direto e tirar dúvidas sem ruído.",
        ],
      },
      {
        type: "heading",
        content: "Quando a pousada faz mais sentido",
      },
      {
        type: "paragraph",
        content:
          "Para muitos perfis de viagem, a pousada entrega o equilíbrio mais interessante entre acolhimento, ritmo mais tranquilo e experiência menos impessoal. Isso pesa bastante em viagens de lazer, em casal ou em família, especialmente quando a ideia é desacelerar.",
      },
      {
        type: "heading",
        content: "O que um bom conteúdo deve responder",
      },
      {
        type: "paragraph",
        content:
          "Além de ajudar a decisão, esse tema precisa preparar o terreno para a conversão. Por isso, o post ideal conecta comparação, critérios objetivos e um próximo passo simples: conhecer a hospedagem, tirar dúvidas ou verificar disponibilidade.",
      },
    ],
  },
  {
    slug: "pousada-ou-hotel-em-serra-negra",
    title: "Pousada ou hotel em Serra Negra: o que vale mais a pena",
    excerpt:
      "Uma comparação direta para quem quer escolher a hospedagem certa sem depender de argumentos genéricos.",
    summary:
      "Peça comparativa de meio de funil voltada para intenção de hospedagem, com foco em clareza de escolha.",
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
        title: "Ângulo comercial correto",
        content:
          "Esse conteúdo funciona melhor quando não tenta empurrar a venda. Ele deve ajudar a pessoa a decidir com segurança e, só então, apresentar a Delplata como uma opção coerente para esse perfil.",
      },
    ],
  },
  {
    slug: "quando-visitar-serra-negra",
    title: "Quando visitar Serra Negra",
    excerpt:
      "Como pensar a melhor época para viajar considerando clima, ritmo de viagem e perfil de hospedagem.",
    summary:
      "Estrutura editorial para um guia sazonal que pode evoluir depois com dados locais e calendário de eventos validado.",
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
        type: "callout",
        title: "Conteúdo seed/demo",
        content:
          "A versão final deste guia deve incluir clima médio, feriados, agenda local e períodos de maior procura, sempre com validação de dados reais.",
      },
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
          "Se o objetivo é encontrar mais disponibilidade para reserva direta.",
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
      "Peça de fundo de funil baseada apenas em informações já presentes no site atual da pousada.",
    publishedAt: "2026-03-05",
    updatedAt: "2026-03-19",
    readingTime: "4 min",
    category: "delplata",
    tags: ["Delplata", "reserva direta", "pousada", "Serra Negra"],
    coverImage: {
      src: "/fotos/piscina-aptos/DJI_0845.jpg",
      alt: "Piscina da Pousada Delplata em Serra Negra",
    },
    seo: {
      title: "Pousada Delplata em Serra Negra | Conheça a hospedagem",
      description:
        "Veja um resumo claro da proposta da Pousada Delplata em Serra Negra e avance para a reserva direta com mais segurança.",
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
          "Canal de reserva direta e contato por WhatsApp.",
        ],
      },
      {
        type: "heading",
        content: "Para quem esse conteúdo funciona melhor",
      },
      {
        type: "paragraph",
        content:
          "Esse tipo de página conversa com quem já passou pela fase de descoberta e está validando se a Delplata combina com a viagem. Por isso, a função do conteúdo não é exagerar diferenciais. É reduzir insegurança, mostrar coerência e facilitar o próximo passo da reserva.",
      },
      {
        type: "callout",
        title: "Evolução futura",
        content:
          "Quando houver um CMS, esta página pode receber depoimentos, perguntas frequentes, diferenciais confirmados pela operação e atualizações sazonais sem mudar a arquitetura do blog.",
      },
    ],
  },
];
