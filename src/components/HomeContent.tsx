"use client";

import { useMemo, useState } from "react";

import { motion } from "framer-motion";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import SearchWidget from "@/components/SearchWidget";
import { ArrowLeft, ArrowRight, BedDouble, Coffee, ShieldCheck, Trees, Users, Waves } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  gaEvent,
  trackClickReservarFinal,
  trackClickWhatsAppFinal,
} from "@/lib/analytics";
import SocialProofBadges from "@/components/SocialProofBadges";
import SpecialDatesSection from "@/components/SpecialDatesSection";
import {
  SPECIAL_DATES,
} from "@/constants/specialDates";

const siteImages = {
  hero: {
    src: "/fotos/piscina-aptos/DJI_0845.jpg",
    alt: "Piscina da Pousada Delplata em Serra Negra",
  },
  accommodations: {
    mainWing: {
      src: "/fotos/ala-principal/apartamentos/superior/DSC_0069-1200.webp",
      alt: "Ala Principal da Pousada Delplata",
    },
    annexWing: {
      src: "/fotos/ala-chales/chales/IMG_0125-1200.webp",
      alt: "Ala Chalés e Anexos da Pousada Delplata",
    },
  },
  leisure: {
    src: "/fotos/piscina-aptos/DJI_0863.jpg",
    alt: "Área de lazer com piscina",
  },
  breakfast: {
    src: "/fotos/restaurante/DSC_0056.jpg",
    alt: "Café da manhã da pousada",
  },
  experiences: {
    pool: {
      src: "/fotos/piscina-aptos/DJI_0863.jpg",
      alt: "Piscina da Pousada Delplata",
    },
    breakfast: {
      src: "/fotos/restaurante/IMG_0025.webp",
      alt: "Mesa de café da manhã da Pousada Delplata",
    },
    family: {
      src: "/fotos/jardim-aptos/DJI_0904.jpg",
      alt: "Área verde da Pousada Delplata para famílias",
    },
    nature: {
      src: "/fotos/jardim-aptos/DSC_0267.jpg",
      alt: "Jardins da Pousada Delplata em Serra Negra",
    },
  },
  cta: {
    src: "/fotos/piscina-aptos/DJI_0908.jpg",
    alt: "Vista da área da piscina para reserva",
  },
  galleryPages: [
    {
      title: "Piscina e hotel",
      images: [
        { src: "/fotos/piscina-aptos/DJI_0863.jpg", alt: "Piscina da pousada" },
        { src: "/fotos/piscina-aptos/DJI_0864.jpg", alt: "Vista aérea da piscina" },
        { src: "/fotos/piscina-aptos/DJI_0900.jpg", alt: "Piscina e estrutura da pousada" },
        { src: "/fotos/piscina-aptos/DJI_0908.jpg", alt: "Vista da piscina com hotel ao fundo" },
        { src: "/fotos/jardim-aptos/DJI_0889.jpg", alt: "Área externa do hotel" },
        { src: "/fotos/jardim-aptos/DJI_0896.jpg", alt: "Vista do hotel e jardins" },
      ],
    },
    {
      title: "Piscina dos chalés",
      images: [
        { src: "/fotos/piscina-chale/DJI_0916.jpg", alt: "Piscina da área dos chalés" },
        { src: "/fotos/piscina-chale/DJI_0917.jpg", alt: "Vista da piscina dos chalés" },
        { src: "/fotos/piscina-chale/DJI_0918.jpg", alt: "Piscina próxima aos chalés" },
        { src: "/fotos/piscina-chale/DSC_0370.jpg", alt: "Detalhe da piscina dos chalés" },
        { src: "/fotos/piscina-chale/DSC_0374.jpg", alt: "Área de lazer da piscina dos chalés" },
        { src: "/fotos/piscina-chale/DSC_0380.jpg", alt: "Piscina da ala de chalés" },
      ],
    },
    {
      title: "Churrasqueiras",
      images: [
        { src: "/fotos/churrasqueira-aptos/DJI_0902.jpg", alt: "Churrasqueira da área dos apartamentos" },
        { src: "/fotos/churrasqueira-aptos/DSC_0269.jpg", alt: "Área de churrasqueira dos apartamentos" },
        { src: "/fotos/churrasqueira-aptos/DSC_0273.jpg", alt: "Espaço de churrasqueira da pousada" },
        { src: "/fotos/churrasqueira-chale/DJI_0920.jpg", alt: "Churrasqueira próxima aos chalés" },
        { src: "/fotos/churrasqueira-chale/DSC_0394.jpg", alt: "Área de churrasqueira dos chalés" },
        { src: "/fotos/churrasqueira-chale/DSC_0396.jpg", alt: "Detalhe da churrasqueira da ala de chalés" },
      ],
    },
    {
      title: "Jardins",
      images: [
        { src: "/fotos/jardim-aptos/DJI_0903.jpg", alt: "Vista dos jardins da pousada" },
        { src: "/fotos/jardim-aptos/DJI_0904.jpg", alt: "Área verde da pousada" },
        { src: "/fotos/jardim-aptos/DSC_0258.jpg", alt: "Jardins e área externa" },
        { src: "/fotos/jardim-aptos/DSC_0262.jpg", alt: "Caminho pelos jardins" },
        { src: "/fotos/jardim-aptos/DSC_0267.jpg", alt: "Jardins da pousada em Serra Negra" },
        { src: "/fotos/jardim-aptos/DSC_0275.jpg", alt: "Área verde e paisagismo da pousada" },
      ],
    },
    {
      title: "Sala de jogos",
      images: [
        { src: "/fotos/Sala de jogos/DSC_0228.jpg", alt: "Sala de jogos da pousada" },
        { src: "/fotos/Sala de jogos/DSC_0232.jpg", alt: "Área interna da sala de jogos" },
        { src: "/fotos/Sala de jogos/DSC_0333.jpg", alt: "Mesa e ambiente da sala de jogos" },
        { src: "/fotos/Sala de jogos/DSC_0334.jpg", alt: "Vista da sala de jogos" },
        { src: "/fotos/Sala de jogos/DSC_0337.jpg", alt: "Detalhes da sala de jogos" },
        { src: "/fotos/Sala de jogos/DSC_0346.jpg", alt: "Espaço de lazer com jogos" },
      ],
    },
    {
      title: "Barzinho",
      images: [
        { src: "/fotos/bar-principal/DJI_0893.jpg", alt: "Vista do bar principal da pousada" },
        { src: "/fotos/bar-principal/DSC_0256.jpg", alt: "Ambiente do barzinho" },
        { src: "/fotos/bar-principal/DSC_0276.jpg", alt: "Bar principal da pousada" },
        { src: "/fotos/bar-principal/DSC_0349.jpg", alt: "Detalhes do bar principal" },
        { src: "/fotos/bar-principal/porcoes/DSC_0279.jpg", alt: "Porções servidas no barzinho" },
        { src: "/fotos/bar-principal/porcoes/IMG_6983.jpg", alt: "Petiscos e porções do barzinho" },
      ],
    },
  ],
} as const;



export default function HomeContent() {
  /* Removed GSAP refs and effects to fix re-render flash */
  /* Using purely Framer Motion for stable SSR/Hydration */

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  const wings = [
    {
      id: 'ala-principal',
      title: 'Ala Principal',
      description: 'Praticidade e ótimo custo-benefício. Perfeito para famílias e casais.',
      highlights: ['Apartamentos térreo e superior', 'Até 4 hóspedes'],
      image: siteImages.accommodations.mainWing,
      link: '/acomodacoes'
    },
    {
      id: 'ala-anexo',
      title: 'Ala Chalés e Anexos',
      description: 'Mais privacidade em meio à natureza. Espaço ideal para relaxar.',
      highlights: ['Chalés e apartamentos anexos', 'Até 5 hóspedes'],
      image: siteImages.accommodations.annexWing,
      link: '/acomodacoes'
    }
  ] as const;

  const experienceBenefits = [
    {
      title: "Piscina",
      description: "Piscina para adultos e crianças, com conforto para toda a família.",
      icon: Waves,
    },
    {
      title: "Café da manhã diário",
      description: "Completo, fresco e servido com carinho todos os dias.",
      icon: Coffee,
    },
    {
      title: "Ambiente familiar",
      description: "Uma estadia acolhedora para relaxar e aproveitar juntos.",
      icon: Trees,
    },
    {
      title: "Melhor tarifa garantida",
      description: "Reserva direta com atendimento próximo e condições mais claras.",
      icon: ShieldCheck,
    },
  ] as const;

  const WHATSAPP_PHONE = "5519999654866";
  const WHATSAPP_MESSAGE = "Olá! Tenho uma dúvida sobre a hospedagem. Já consultei no site, pode me ajudar?";
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  const [activeGalleryPage, setActiveGalleryPage] = useState(0);
  const enabledSpecialDates = useMemo(
    () => SPECIAL_DATES.filter((specialDate) => specialDate.enabled),
    []
  );
  const currentGalleryPage = siteImages.galleryPages[activeGalleryPage];

  const handleSpecialDateClick = (specialDateId: string) => {
    gaEvent("home_special_dates_click", { special_date_id: specialDateId });
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section with Background Image */}
      <section className="relative flex min-h-[88vh] w-full items-end overflow-hidden bg-[color:var(--brand-black)]">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={siteImages.hero.src}
            alt={siteImages.hero.alt}
            fill
            sizes="100vw"
            className="object-cover object-center"
            quality={88}
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(40,50,35,0.72)_0%,rgba(40,50,35,0.46)_38%,rgba(40,50,35,0.18)_65%,rgba(9,9,9,0.18)_100%)]" />
        </div>

        <motion.div
          className="container relative z-10 flex min-h-[88vh] flex-col justify-center pb-12 pt-28 sm:pb-14 lg:pb-16 lg:pt-32"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <div className="grid gap-8 lg:min-h-[64vh] lg:grid-cols-[minmax(0,620px)_1fr] lg:items-center">
            <motion.div
              variants={containerVariants}
              className="max-w-[34rem] space-y-6 pb-2 text-left sm:space-y-7"
            >
              <motion.p
                variants={itemVariants}
                className="font-accent text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[color:var(--brand-gold)] [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]"
              >
                Serra Negra · SP
              </motion.p>

              <motion.h1
                variants={itemVariants}
                className="font-hero-display max-w-[9ch] text-[3rem] font-bold leading-[0.94] text-white sm:text-[4.2rem] lg:text-[5rem]"
              >
                Seu refúgio em Serra Negra
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="max-w-[30ch] text-base leading-8 text-[color:var(--brand-white)] [text-shadow:0_1px_16px_rgba(0,0,0,0.38)] sm:text-lg"
              >
                Silêncio, natureza e conforto para um fim de semana sem pressa.
              </motion.p>

              <motion.div variants={itemVariants} className="flex flex-wrap gap-3 pt-2">
                <Button asChild className="h-12 rounded-none bg-[color:var(--brand-gold)] px-6 font-sans text-sm font-semibold text-[color:var(--brand-forest)] shadow-none hover:bg-[color:var(--brand-gold)]/90">
                  <Link href="/reservar">
                    Ver disponibilidade
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-none border-[color:var(--brand-gold)]/60 bg-[color:var(--forest-soft)] px-6 font-sans text-sm font-medium text-[color:var(--brand-white)] shadow-none transition-all duration-200 hover:-translate-y-px hover:border-[color:var(--brand-white)]/70 hover:bg-[color:var(--brand-forest)] hover:text-[color:var(--brand-white)]">
                  <Link href="/acomodacoes">
                    Conheça a pousada
                  </Link>
                </Button>
              </motion.div>

            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Avaliações e Motor de Reservas Integrados */}
      <section className="section-space-overlap relative bg-[color:var(--brand-cream)]">
        <div className="container">
          <div className="relative z-30 mx-auto mb-12 max-w-6xl -mt-28 lg:-mt-24 lg:mb-16">
            <SearchWidget
              uiPreset="hero"
              submitLabel="Ver disponibilidade"
              submitLabelMobile="Buscar"
              collapsible={false}
            />
          </div>
          <SocialProofBadges variant="light" className="max-w-5xl mx-auto" />
        </div>
      </section>

      {/* Accommodations Section */}
      <section className="section-space-md bg-[color:var(--brand-cream)]">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="mb-12 text-center md:mb-16"
          >
            <p className="mb-4 font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)] md:text-[0.8rem]">
              Hospedagem
            </p>
            <motion.h2 variants={itemVariants} className="font-hero-display text-[2.4rem] leading-tight text-[#1d1b19] md:text-[3.2rem]">
              Nossas Acomodações
            </motion.h2>
          </motion.div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:gap-10">
            {wings.map((wing, index) => (
              <motion.div
                key={wing.id}
                className="h-full"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                <Link href={wing.link} className="block h-full group">
                  <Card className="h-full overflow-hidden rounded-none border border-primary/10 bg-white shadow-none transition-colors duration-300 hover:border-primary/20">
                    <div className="relative aspect-[4/3] w-full overflow-hidden">
                      <Image
                        src={wing.image.src}
                        alt={wing.image.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 560px"
                        quality={80}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="px-8 pb-8 pt-7">
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-display text-[2rem] font-medium leading-tight text-[#1d1b19]">
                            {wing.title}
                          </h3>
                          <p className="mt-3 font-sans text-[1.05rem] leading-relaxed text-[#1d1b19]/82">
                            {wing.description}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-[#1d1b19]/10 pt-5">
                          <div className="inline-flex items-center gap-2 font-sans text-[0.9rem] text-[#1d1b19]/80">
                            <BedDouble className="h-4 w-4 text-[#b58b58]" strokeWidth={2} />
                            <span>{wing.highlights[0]}</span>
                          </div>
                          <div className="inline-flex items-center gap-2 font-sans text-[0.9rem] text-[#1d1b19]/80">
                            <Users className="h-4 w-4 text-[#b58b58]" strokeWidth={2} />
                            <span>{wing.highlights[1]}</span>
                          </div>
                        </div>
                        <div className="pt-3">
                          <span className="inline-flex h-12 w-full items-center justify-center border border-primary/15 bg-[color:var(--brand-cream)] px-5 font-sans text-[0.78rem] font-bold uppercase tracking-[0.14em] text-[color:var(--brand-forest)] transition-colors duration-300 group-hover:border-primary/25 group-hover:text-primary">
                            Ver detalhes
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Experiências */}
      <section id="sobre" className="section-space-md bg-background">
        <div className="container">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center md:mb-16">
              <p className="font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)] md:text-[0.8rem]">
                Experiências
              </p>
              <h2 className="font-hero-display mt-4 text-[2.4rem] leading-tight text-[#1d1b19] md:text-[3.2rem]">
                O que torna a estadia especial
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-10">
              {experienceBenefits.map((benefit) => {
                const Icon = benefit.icon;

                return (
                  <div key={benefit.title} className="group flex items-start gap-4 border-t border-primary/10 pt-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[color:var(--brand-gold)] transition-colors duration-200 group-hover:text-[color:var(--brand-forest)]">
                      <Icon className="h-9 w-9" aria-hidden="true" strokeWidth={1.7} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-sans text-[1.03rem] font-semibold leading-6 text-[#1d1b19]">
                        {benefit.title}
                      </p>
                      <p className="mt-2 font-sans text-[0.98rem] leading-7 text-[#1d1b19]/72">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Galeria */}
      <section className="section-space-md bg-[color:var(--brand-cream)] text-primary">
        <div className="container">
          <div className="mb-12 flex flex-col gap-6 text-center md:mb-16 md:flex-row md:items-end md:justify-between md:text-left">
            <div>
              <p className="font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)] md:text-[0.8rem]">
                Galeria
              </p>
              <h2 className="font-hero-display mt-4 text-[2.4rem] leading-tight md:text-[3.2rem]">
                Nossa pousada em imagens
              </h2>
              <p className="mt-3 font-sans text-[0.98rem] leading-7 text-primary/72">
                {currentGalleryPage.title}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 md:justify-end">
              <button
                type="button"
                aria-label="Ver grupo anterior de fotos"
                onClick={() =>
                  setActiveGalleryPage((current) =>
                    current === 0 ? siteImages.galleryPages.length - 1 : current - 1
                  )
                }
                className="inline-flex h-12 w-12 items-center justify-center rounded-none border border-primary/15 bg-[color:var(--brand-white)] text-primary transition-colors duration-200 hover:bg-[color:var(--brand-cream)]"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                aria-label="Ver próximo grupo de fotos"
                onClick={() =>
                  setActiveGalleryPage((current) =>
                    current === siteImages.galleryPages.length - 1 ? 0 : current + 1
                  )
                }
                className="inline-flex h-12 w-12 items-center justify-center rounded-none border border-primary/15 bg-[color:var(--brand-white)] text-primary transition-colors duration-200 hover:bg-[color:var(--brand-cream)]"
              >
                <ArrowRight className="h-5 w-5" strokeWidth={1.8} />
              </button>
            </div>
          </div>
          <div key={currentGalleryPage.title} className="mx-auto grid max-w-[82rem] grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {currentGalleryPage.images.map((img, i) => (
              <div key={img.src} className="relative aspect-[4/3] overflow-hidden border border-primary/10">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Special Dates Section */}
      <SpecialDatesSection
        dates={enabledSpecialDates}
        onDateClick={(specialDate) => handleSpecialDateClick(specialDate.id)}
      />

      {/* CTA Section */}
      <section className="section-space-lg relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={siteImages.cta.src}
            alt={siteImages.cta.alt}
            fill
            sizes="100vw"
            quality={85}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(40,50,35,0.78)_0%,rgba(40,50,35,0.72)_100%)]" />
        </div>
        <div className="container relative z-10 text-center text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl space-y-8"
          >
            <div className="space-y-4">
              <h2 className="font-hero-display text-4xl font-medium md:text-5xl lg:text-6xl">
                Planeje um fim de semana tranquilo na serra
              </h2>
              <p className="text-lg leading-8 text-white/88 md:text-xl">
                Consulte a disponibilidade e escolha a acomodação ideal para descansar com calma, natureza e conforto.
              </p>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <div className="grid w-full max-w-lg grid-cols-1 gap-4 justify-center sm:grid-cols-2">
                <Button asChild size="lg" className="h-14 rounded-none bg-[color:var(--brand-gold)] px-8 text-base text-[color:var(--brand-forest)] shadow-none hover:bg-[color:var(--brand-gold)]/90">
                  <Link href="/reservar" onClick={() => trackClickReservarFinal("final")}>
                    Ver disponibilidade
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 rounded-none border-[color:var(--brand-gold)]/60 bg-[color:var(--forest-soft)] px-8 text-base text-[color:var(--brand-white)] shadow-none transition-all duration-200 hover:-translate-y-px hover:border-[color:var(--brand-white)]/70 hover:bg-[color:var(--brand-forest)] hover:text-[color:var(--brand-white)]">
                  <Link
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackClickWhatsAppFinal("final")}
                  >
                    Falar no WhatsApp
                  </Link>
                </Button>
              </div>
              <p className="text-sm font-medium text-white/70">
                * Fins de semana e feriados costumam esgotar rápido.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
