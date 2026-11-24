import Image from "next/image";
import Link from "next/link";

import { PET_FEE_PER_NIGHT } from "@/lib/booking-price";
import { MAX_PETS_PER_BOOKING } from "@/lib/pet-policy";
import HomeTop from "./HomeTop";
import AreasTrail, { type GalleryArea } from "./AreasTrail";
import Reveal from "./Reveal";
import SpecialDatesIsland from "./SpecialDatesIsland";
import TrackedLink from "./TrackedLink";
import styles from "./home-novo.module.css";

const WHATSAPP_PHONE = "5519999654866";
const WHATSAPP_MESSAGE = "Olá! Tenho uma dúvida sobre a hospedagem. Já consultei no site, pode me ajudar?";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

// Título de seção: nunca passa da altura da tela (usa vw e vh, o menor dos dois).
const H2 = "text-[clamp(1.9rem,min(4.6vw,7vh),3.8rem)]";

const MARQUEE_ITEMS = [
  "Piscinas",
  "Café da manhã diário",
  "Chalés e anexos",
  "Ambiente familiar",
  "Reserva direta pelo site",
  "Serra Negra · SP",
];

// Áreas da pousada: cada cartão abre uma galeria só com as fotos daquela área.
// A legenda de cada foto diz se é do hotel (apartamentos) ou dos chalés.
const AREAS: readonly GalleryArea[] = [
  {
    id: "piscinas",
    title: "Piscinas",
    note: "Duas piscinas: a do hotel e a dos chalés",
    cover: "/fotos/piscina-aptos/DJI_0864.jpg",
    photos: [
      { src: "/fotos/piscina-aptos/DJI_0864.jpg", alt: "Piscina do hotel vista de cima", caption: "Piscina do hotel (apartamentos)" },
      { src: "/fotos/piscina-aptos/DJI_0866.jpg", alt: "Piscina do hotel com guarda-sóis", caption: "Piscina do hotel (apartamentos)" },
      { src: "/fotos/piscina-aptos/DJI_0900.jpg", alt: "Piscina do hotel e espreguiçadeiras", caption: "Piscina do hotel (apartamentos)" },
      { src: "/fotos/piscina-aptos/DSC_0229.jpg", alt: "Piscina do hotel com cascata", caption: "Piscina do hotel (apartamentos)" },
      { src: "/fotos/piscina-aptos/DSC_0252.jpg", alt: "Piscina do hotel e área de descanso", caption: "Piscina do hotel (apartamentos)" },
      { src: "/fotos/piscina-aptos/DJI_0845.jpg", alt: "Piscina do hotel e piscina infantil", caption: "Piscina do hotel (apartamentos)" },
      { src: "/fotos/piscina-chale/DJI_0916.jpg", alt: "Piscina dos chalés vista de cima", caption: "Piscina dos chalés" },
      { src: "/fotos/piscina-chale/DJI_0917.jpg", alt: "Piscina dos chalés com mesas e espreguiçadeiras", caption: "Piscina dos chalés" },
      { src: "/fotos/piscina-chale/DJI_0918.jpg", alt: "Piscina dos chalés e área de lazer", caption: "Piscina dos chalés" },
      { src: "/fotos/piscina-chale/DSC_0370.jpg", alt: "Piscina dos chalés e os chalés ao fundo", caption: "Piscina dos chalés" },
      { src: "/fotos/piscina-chale/DSC_0374.jpg", alt: "Piscina dos chalés com guarda-sol", caption: "Piscina dos chalés" },
      { src: "/fotos/piscina-chale/DSC_0378.jpg", alt: "Piscina dos chalés e espreguiçadeiras", caption: "Piscina dos chalés" },
    ],
  },
  {
    id: "churrasqueiras",
    title: "Churrasqueiras",
    note: "Uma no hotel e outra nos chalés",
    cover: "/fotos/churrasqueira-chale/DJI_0920.jpg",
    photos: [
      { src: "/fotos/churrasqueira-aptos/DJI_0902.jpg", alt: "Churrasqueira coberta do hotel vista de cima", caption: "Churrasqueira do hotel (apartamentos)" },
      { src: "/fotos/churrasqueira-aptos/DSC_0269.jpg", alt: "Mesa e churrasqueira do hotel", caption: "Churrasqueira do hotel (apartamentos)" },
      { src: "/fotos/churrasqueira-aptos/DSC_0273.jpg", alt: "Área da churrasqueira do hotel com vista do jardim", caption: "Churrasqueira do hotel (apartamentos)" },
      { src: "/fotos/churrasqueira-chale/DJI_0920.jpg", alt: "Churrasqueira dos chalés com rede", caption: "Churrasqueira dos chalés" },
      { src: "/fotos/churrasqueira-chale/DSC_0394.jpg", alt: "Churrasqueira dos chalés com mesa e bancos", caption: "Churrasqueira dos chalés" },
      { src: "/fotos/churrasqueira-chale/DSC_0396.jpg", alt: "Mesa da churrasqueira dos chalés", caption: "Churrasqueira dos chalés" },
    ],
  },
  {
    id: "jardins",
    title: "Jardins e redes",
    note: "Gramado, redes e balanço no hotel",
    cover: "/fotos/jardim-aptos/DJI_0903.jpg",
    photos: [
      { src: "/fotos/jardim-aptos/DJI_0903.jpg", alt: "Rede e balanço no gramado", caption: "Rede e balanço nos jardins do hotel" },
      { src: "/fotos/jardim-aptos/DJI_0889.jpg", alt: "Jardim ao lado dos apartamentos", caption: "Jardim do hotel (apartamentos)" },
      { src: "/fotos/jardim-aptos/DJI_0896.jpg", alt: "Jardim com gangorra e balanço", caption: "Jardim do hotel (apartamentos)" },
      { src: "/fotos/jardim-aptos/DSC_0258.jpg", alt: "Gramado e redes do hotel", caption: "Jardim do hotel (apartamentos)" },
      { src: "/fotos/jardim-aptos/DSC_0262.jpg", alt: "Rede de balanço no gramado", caption: "Rede nos jardins do hotel" },
      { src: "/fotos/jardim-aptos/IMG_0137.jpg", alt: "Banco de pedra entre as plantas", caption: "Jardim do hotel (apartamentos)" },
    ],
  },
  {
    id: "bar",
    title: "Barzinho e petiscos",
    note: "Do balcão à beira da piscina",
    cover: "/fotos/bar-principal/DJI_0893.jpg",
    photos: [
      { src: "/fotos/bar-principal/DJI_0893.jpg", alt: "Balcão do barzinho com banquetas", caption: "Barzinho" },
      { src: "/fotos/bar-principal/DSC_0349.jpg", alt: "Mesas do barzinho", caption: "Barzinho" },
      { src: "/fotos/bar-principal/DSC_0351.jpg", alt: "Mesa de madeira do barzinho", caption: "Barzinho" },
      { src: "/fotos/bar-principal/DSC_0256.jpg", alt: "Terraço com mesas e guarda-sóis", caption: "Terraço do barzinho com vista da piscina" },
      { src: "/fotos/bar-principal/porcoes/DSC_0312.jpg", alt: "Caipirinha na borda da piscina", caption: "Caipirinha à beira da piscina" },
      { src: "/fotos/bar-principal/porcoes/DSC_0316.jpg", alt: "Prato de salame na borda da piscina", caption: "Petiscos à beira da piscina" },
      { src: "/fotos/bar-principal/porcoes/IMG_7003.jpg", alt: "Porções à beira da piscina dos chalés", caption: "Petiscos e refrigerante à beira da piscina" },
    ],
  },
  {
    id: "jogos",
    title: "Sala de jogos",
    note: "Sinuca, pebolim e mesas de carteado",
    cover: "/fotos/Sala de jogos/DSC_0333.jpg",
    photos: [
      { src: "/fotos/Sala de jogos/DSC_0333.jpg", alt: "Mesa de sinuca", caption: "Sala de jogos: mesa de sinuca" },
      { src: "/fotos/Sala de jogos/DSC_0334.jpg", alt: "Sala de jogos com mesa de sinuca", caption: "Sala de jogos: mesa de sinuca" },
      { src: "/fotos/Sala de jogos/DSC_0232.jpg", alt: "Mesa de pebolim", caption: "Sala de jogos: pebolim" },
      { src: "/fotos/Sala de jogos/DSC_0339.jpg", alt: "Mesas de carteado", caption: "Sala de jogos: mesas de carteado" },
      { src: "/fotos/Sala de jogos/DSC_0346.jpg", alt: "Sala de jogos com sofás e mesas", caption: "Sala de jogos: cantinho de descanso" },
    ],
  },
  {
    id: "cafe",
    title: "Café da manhã",
    note: "Servido todos os dias",
    cover: "/fotos/restaurante/DSC_0056.jpg",
    photos: [
      { src: "/fotos/restaurante/DSC_0056.jpg", alt: "Mesa de café da manhã com vista", caption: "Café da manhã" },
      { src: "/fotos/restaurante/DSC_0002.jpg", alt: "Buffet do café da manhã", caption: "Buffet do café da manhã" },
      { src: "/fotos/restaurante/DSC_0053.jpg", alt: "Mesa posta com frutas, pães e suco", caption: "Café da manhã" },
      { src: "/fotos/restaurante/DSC_0018.jpg", alt: "Bolo de coco", caption: "Café da manhã: bolos caseiros" },
      { src: "/fotos/restaurante/IMG_0003.jpg", alt: "Cestas de pães", caption: "Café da manhã: pães" },
      { src: "/fotos/restaurante/DSC_0082.jpg", alt: "Salão do café da manhã", caption: "Salão do café da manhã" },
    ],
  },
];

const FAQ = [
  {
    question: "Posso reservar direto pelo site?",
    answer:
      "Sim. Você consulta datas e valores no próprio site, escolhe a acomodação e conclui a reserva online. A disponibilidade vem do nosso sistema de reservas.",
  },
  {
    question: "Quais são as formas de pagamento?",
    answer: "O pagamento da reserva online é feito pelo Mercado Pago, com Pix ou cartão.",
  },
  {
    question: "A pousada aceita pets?",
    answer: `Aceitamos pets de pequeno porte, até ${MAX_PETS_PER_BOOKING} por reserva, nos apartamentos térreos, chalés e anexos. A taxa é de R$ ${PET_FEE_PER_NIGHT} por pet por diária. O Apartamento Superior não aceita pets.`,
  },
  {
    question: "Como funciona o cancelamento?",
    answer: "As regras de cancelamento e reembolso estão na página de política de cancelamento, que você pode ler antes de reservar.",
  },
] as const;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function HomeNovo() {
  const marquee = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <main className="min-h-screen overflow-x-clip">
      <HomeTop />

      {/* Faixa de promessas */}
      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.marqueeTrack}>
          {[...marquee, ...marquee].map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex items-center gap-[2.2rem]">
              {item}
              <i className={styles.marqueeDot} />
            </span>
          ))}
        </div>
      </div>

      {/* Reserva direta: o botão do motor logo abaixo do topo */}
      <section className="bg-[color:var(--brand-forest)] py-6 text-white">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-center text-lg font-semibold md:text-left">
            Reserva direta pelo site oficial: veja datas e valores na hora.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <TrackedLink
              href="/reservar"
              track="reservar_final"
              className="inline-flex h-12 items-center bg-[color:var(--brand-gold)] px-7 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
            >
              Ver disponibilidade
            </TrackedLink>
            <TrackedLink
              href={WHATSAPP_URL}
              track="whatsapp_final"
              external
              className="inline-flex h-12 items-center border border-white/50 px-7 text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-white/10"
            >
              Falar no WhatsApp
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* Trilha horizontal de fotos: a rolagem vertical empurra as fotos para o lado (desktop) */}
      <section
        id="sobre"
        data-hscroll-section
        className={`${styles.fit} ${styles.grain} relative bg-[color:var(--brand-forest)] py-8 text-white md:pb-6 md:pt-[104px]`}
      >
        <div className="container flex shrink-0 flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-10" data-reveal>
          <div>
            <p className={`${styles.eyebrow} text-[color:var(--brand-gold)]`}>Conheça a pousada</p>
            <h2 className={`${styles.display} mt-3 ${H2}`}>
              Cada <em>cantinho</em>
            </h2>
          </div>
          <p className="max-w-[44ch] text-base leading-7 text-white/80">
            Escolha uma área para ver todas as fotos. Em cada foto, a legenda diz se é do hotel ou dos chalés.
          </p>
        </div>
        <div data-hscroll className="mt-5 h-[62svh] min-h-0 overflow-x-auto md:mt-4 md:h-auto md:flex-1">
          <AreasTrail areas={AREAS} />
        </div>
      </section>

      {/* Zoom na piscina: a moldura abre conforme a rolagem; a seção continua com 100vh */}
      <section data-zoom className="relative h-[100svh] overflow-hidden bg-[color:var(--brand-forest)]">
        {/* Fundo: a própria foto, desfocada, para a moldura não abrir sobre um fundo preto */}
        <div aria-hidden="true" className="absolute inset-0">
          <Image
            src="/fotos/piscina-aptos/DJI_0866.jpg"
            alt=""
            fill
            sizes="25vw"
            quality={72}
            className="scale-125 object-cover blur-2xl"
          />
          <div className="absolute inset-0 bg-[rgba(20,28,18,0.62)]" />
        </div>
        <div data-zoom-frame className="absolute inset-0">
          <Image
            src="/fotos/piscina-aptos/DJI_0866.jpg"
            alt="Piscina da pousada vista de cima, com guarda-sóis"
            fill
            sizes="100vw"
            quality={85}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,28,18,0.7)_0%,rgba(20,28,18,0.2)_70%)]" />
        </div>
        <div className="container relative z-10 flex h-full flex-col justify-center">
          <p className={`${styles.eyebrow} text-[#efe3a0]`}>Lazer</p>
          <h2 className={`${styles.display} ${styles.onPhoto} mt-4 max-w-3xl text-[clamp(2.2rem,min(5.6vw,9vh),4.8rem)] text-white`}>
            Mergulhe <em>sem pressa</em>
          </h2>
        </div>
      </section>

      <SpecialDatesIsland />

      {/* Perguntas frequentes */}
      <section className={`${styles.fit} bg-[color:var(--brand-cream)] py-10 text-[color:var(--brand-forest)] md:pb-8 md:pt-[104px]`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <div data-reveal>
              <p className={`${styles.eyebrow} text-[color:var(--brand-forest)]`}>Antes de reservar</p>
              <h2 className={`${styles.display} ${styles.displayDark} mt-3 ${H2}`}>
                Perguntas <em>frequentes</em>
              </h2>
            </div>
            <div className="mt-6 divide-y divide-[rgba(40,50,35,0.15)] border-y border-[rgba(40,50,35,0.15)]">
              {FAQ.map((item) => (
                <details key={item.question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold">
                    {item.question}
                    <span aria-hidden="true" className="text-2xl leading-none text-[color:var(--brand-gold)] transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[62ch] leading-7 text-[rgba(40,50,35,0.8)]">{item.answer}</p>
                  {item.question.startsWith("Como funciona o cancelamento") ? (
                    <Link href="/politica-de-cancelamento" className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">
                      Ler a política de cancelamento
                    </Link>
                  ) : null}
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reserva final */}
      <section className={`${styles.fit} relative overflow-hidden py-16 md:py-0`}>
        <div className="absolute inset-0">
          <Image src="/fotos/piscina-aptos/DJI_0900.jpg" alt="" fill sizes="100vw" quality={82} className="object-cover" />
          <div className="absolute inset-0 bg-[rgba(40,50,35,0.82)]" />
        </div>
        <div className="container relative z-10 text-center text-white" data-reveal>
          <h2 className={`${styles.display} ${styles.onPhoto} mx-auto max-w-4xl text-[clamp(2.2rem,min(5.6vw,9vh),4.8rem)]`}>
            Sua próxima <em>estadia</em> começa aqui
          </h2>
          <p className="mx-auto mt-6 max-w-[48ch] text-lg leading-8 text-white/88">
            Consulte a disponibilidade e escolha uma acomodação para sua estadia.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <TrackedLink
              href="/reservar"
              track="reservar_final"
              className="inline-flex h-14 items-center bg-[color:var(--brand-gold)] px-9 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
            >
              Ver disponibilidade
            </TrackedLink>
            <TrackedLink
              href={WHATSAPP_URL}
              track="whatsapp_final"
              external
              className="inline-flex h-14 items-center border border-white/60 px-9 text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-white/10"
            >
              Falar no WhatsApp
            </TrackedLink>
          </div>
          <p className="mt-6 text-sm text-white/70">Valores e disponibilidade são confirmados no motor de reservas.</p>
        </div>
      </section>

      <Reveal />
    </main>
  );
}
