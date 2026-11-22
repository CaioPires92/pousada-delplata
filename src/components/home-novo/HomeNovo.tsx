import Image from "next/image";
import Link from "next/link";

import { PET_FEE_PER_NIGHT } from "@/lib/booking-price";
import { MAX_PETS_PER_BOOKING } from "@/lib/pet-policy";
import HomeTop from "./HomeTop";
import Reveal from "./Reveal";
import SpecialDatesIsland from "./SpecialDatesIsland";
import TrackedLink from "./TrackedLink";
import styles from "./home-novo.module.css";

const WHATSAPP_PHONE = "5519999654866";
const WHATSAPP_MESSAGE = "Olá! Tenho uma dúvida sobre a hospedagem. Já consultei no site, pode me ajudar?";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const MARQUEE_ITEMS = [
  "Piscinas",
  "Café da manhã diário",
  "Chalés e anexos",
  "Ambiente familiar",
  "Reserva direta pelo site",
  "Serra Negra · SP",
];

const STRIP_A = [
  "/fotos/piscina-aptos/DJI_0863.jpg",
  "/fotos/jardim-aptos/DJI_0904.jpg",
  "/fotos/piscina-chale/DJI_0916.jpg",
  "/fotos/churrasqueira-aptos/DJI_0902.jpg",
  "/fotos/jardim-aptos/DJI_0889.jpg",
  "/fotos/piscina-aptos/DJI_0866.jpg",
];
const STRIP_B = [
  "/fotos/piscina-chale/DJI_0917.jpg",
  "/fotos/jardim-aptos/DSC_0267.jpg",
  "/fotos/piscina-aptos/DJI_0900.jpg",
  "/fotos/Sala de jogos/DSC_0228.jpg",
  "/fotos/piscina-chale/DJI_0918.jpg",
  "/fotos/jardim-aptos/DJI_0896.jpg",
];

const BENTO = [
  {
    title: "Piscinas",
    text: "Piscinas para adultos e crianças nas áreas de lazer da pousada.",
    src: "/fotos/piscina-aptos/DJI_0863.jpg",
    alt: "Piscina da Pousada Delplata",
    className: "md:col-span-2 md:row-span-2",
  },
  {
    title: "Café da manhã",
    text: "Servido diariamente durante a hospedagem.",
    src: "/fotos/restaurante/DSC_0056.jpg",
    alt: "Café da manhã da pousada",
    className: "",
  },
  {
    title: "Jardins",
    text: "Áreas verdes para caminhar e descansar.",
    src: "/fotos/jardim-aptos/DSC_0267.jpg",
    alt: "Jardins da Pousada Delplata",
    className: "",
  },
  {
    title: "Sala de jogos",
    text: "Espaço de lazer com jogos.",
    src: "/fotos/Sala de jogos/DSC_0228.jpg",
    alt: "Sala de jogos da pousada",
    className: "",
  },
  {
    title: "Churrasqueiras",
    text: "Áreas de churrasqueira perto dos apartamentos e dos chalés.",
    src: "/fotos/churrasqueira-chale/DJI_0920.jpg",
    alt: "Churrasqueira próxima aos chalés",
    className: "",
  },
] as const;

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

function Strip({ images, reverse = false }: { images: string[]; reverse?: boolean }) {
  const loop = [...images, ...images];
  return (
    <div className={`${styles.strip} ${reverse ? styles.stripReverse : ""}`} aria-hidden="true">
      <div className={styles.stripTrack}>
        {loop.map((src, index) => (
          <div key={`${src}-${index}`}>
            <Image src={src} alt="" fill sizes="(max-width: 768px) 60vw, 28vw" className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeNovo() {
  const marquee = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <main className="min-h-screen">
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

      {/* Conheça a pousada */}
      <section id="sobre" className="overflow-hidden bg-[color:var(--brand-cream)] py-20 text-[color:var(--brand-forest)] md:py-28">
        <div className="container">
          <div className="mx-auto max-w-4xl text-center" data-reveal>
            <p className={`${styles.eyebrow} text-[color:var(--brand-forest)]`}>Conheça a pousada</p>
            <h2 className={`${styles.display} ${styles.displayDark} mt-5 text-[clamp(2.2rem,5.6vw,4.8rem)]`}>
              Um lugar tranquilo <em>rodeado de natureza</em>
            </h2>
            <p className="mx-auto mt-6 max-w-[56ch] text-base leading-8 text-[color:var(--brand-forest)]/80 md:text-lg">
              O Hotel Pousada Delplata é um local tranquilo e rodeado de muita natureza, ambiente ideal para descansar,
              sair da rotina e renovar as energias.
            </p>
          </div>
        </div>
        <div className="mt-14 space-y-4">
          <Strip images={STRIP_A} />
          <Strip images={STRIP_B} reverse />
        </div>
      </section>

      {/* Estrutura */}
      <section className="bg-[color:var(--brand-forest)] py-20 text-white md:py-28">
        <div className="container">
          <div className="mb-12 max-w-3xl" data-reveal>
            <p className={`${styles.eyebrow} text-[color:var(--brand-gold)]`}>Para a família toda</p>
            <h2 className={`${styles.display} mt-5 text-[clamp(2.2rem,5.6vw,4.8rem)]`}>
              Muito para <em>aproveitar</em>
            </h2>
          </div>
          <div className="grid auto-rows-[260px] grid-cols-1 gap-4 md:grid-cols-4">
            {BENTO.map((item) => (
              <figure key={item.title} className={`group relative overflow-hidden ${item.className}`} data-reveal>
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5">
                  <strong className="block text-lg font-semibold">{item.title}</strong>
                  <span className="mt-1 block max-w-[34ch] text-sm leading-6 text-white/85">{item.text}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Onde ficar */}
      <section className="bg-[color:var(--brand-cream)] py-20 text-[color:var(--brand-forest)] md:py-28">
        <div className="container">
          <div className="mb-12 max-w-3xl" data-reveal>
            <p className={`${styles.eyebrow} text-[color:var(--brand-forest)]`}>Acomodações</p>
            <h2 className={`${styles.display} ${styles.displayDark} mt-5 text-[clamp(2.2rem,5.6vw,4.8rem)]`}>
              Escolha onde <em>ficar</em>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                title: "Ala principal",
                text: "Apartamentos na ala principal da pousada.",
                src: "/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp",
                alt: "Ala principal da Pousada Delplata",
              },
              {
                title: "Chalés e anexos",
                text: "Chalés e apartamentos anexos, com pets de pequeno porte aceitos mediante taxa.",
                src: "/fotos/ala-chales/chales/IMG_0125-1200.webp",
                alt: "Ala de chalés e anexos da Pousada Delplata",
              },
            ].map((wing) => (
              <Link
                key={wing.title}
                href="/acomodacoes"
                className="group relative block aspect-[4/3] overflow-hidden"
                data-reveal
              >
                <Image
                  src={wing.src}
                  alt={wing.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8">
                  <h3 className={`${styles.display} text-3xl md:text-4xl`}>{wing.title}</h3>
                  <p className="mt-2 max-w-[40ch] text-sm leading-6 text-white/88">{wing.text}</p>
                  <span className="mt-4 inline-block border-b border-[color:var(--brand-gold)] pb-1 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-gold)]">
                    Ver acomodações
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SpecialDatesIsland />

      {/* Panorama */}
      <section className="relative h-[70vh] min-h-[420px] overflow-hidden bg-[color:var(--brand-black)]">
        <div className="absolute inset-0">
          <div className={`absolute -inset-y-[10%] inset-x-0 ${styles.panoImg}`} data-parallax>
            <Image
              src="/fotos/piscina-chale/DJI_0916.jpg"
              alt="Vista aérea da piscina e dos chalés da pousada"
              fill
              sizes="100vw"
              quality={80}
              className="object-cover"
            />
          </div>
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,28,18,0.78)_0%,rgba(20,28,18,0.35)_60%,rgba(20,28,18,0.1)_100%)]" />
        <div className="container relative z-10 flex h-full items-center">
          <div data-reveal>
            <p className={`${styles.eyebrow} text-[color:var(--brand-gold)]`}>Vista do alto</p>
            <h2 className={`${styles.display} ${styles.onPhoto} mt-5 text-[clamp(2.4rem,6.5vw,5.6rem)] text-white`}>
              A pousada <em>vista do alto</em>
            </h2>
          </div>
        </div>
      </section>

      {/* Perguntas frequentes */}
      <section className="bg-[color:var(--brand-cream)] py-20 text-[color:var(--brand-forest)] md:py-28">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <div data-reveal>
              <p className={`${styles.eyebrow} text-[color:var(--brand-forest)]`}>Antes de reservar</p>
              <h2 className={`${styles.display} ${styles.displayDark} mt-5 text-[clamp(2rem,5vw,4rem)]`}>
                Perguntas <em>frequentes</em>
              </h2>
            </div>
            <div className="mt-10 divide-y divide-[color:var(--brand-forest)]/15 border-y border-[color:var(--brand-forest)]/15">
              {FAQ.map((item) => (
                <details key={item.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold">
                    {item.question}
                    <span aria-hidden="true" className="text-2xl leading-none text-[color:var(--brand-gold)] transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[62ch] leading-7 text-[color:var(--brand-forest)]/80">{item.answer}</p>
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
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0">
          <Image src="/fotos/piscina-aptos/DJI_0900.jpg" alt="" fill sizes="100vw" quality={80} className="object-cover" />
          <div className="absolute inset-0 bg-[color:var(--brand-forest)]/82" />
        </div>
        <div className="container relative z-10 text-center text-white" data-reveal>
          <h2 className={`${styles.display} ${styles.onPhoto} mx-auto max-w-4xl text-[clamp(2.4rem,6.5vw,5.6rem)]`}>
            Sua próxima <em>estadia</em> começa aqui
          </h2>
          <p className="mx-auto mt-6 max-w-[48ch] text-lg leading-8 text-white/88">
            Consulte a disponibilidade e escolha uma acomodação para sua estadia.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
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
