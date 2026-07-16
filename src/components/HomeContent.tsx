"use client";

import { useCallback, useMemo, useState } from "react";

import { motion } from "framer-motion";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import SearchWidget from "@/components/SearchWidget";
import { ArrowLeft, ArrowRight, CalendarCheck2, Coffee, Trees, Waves } from "lucide-react";
import {
  gaEvent,
  trackClickReservarHero,
  trackClickReservarFinal,
  trackClickWhatsAppFinal,
} from "@/lib/analytics";
import { formatDateBRFromYmd } from "@/lib/date";
import SocialProofBadges from "@/components/SocialProofBadges";
import HomeAvailabilityOffers, { type HomeOfferSummary } from "@/components/HomeAvailabilityOffers";
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

  const experienceBenefits = [
    {
      title: "Piscina",
      description: "Piscinas para adultos e crianças nas áreas de lazer da pousada.",
      icon: Waves,
    },
    {
      title: "Café da manhã diário",
      description: "Café da manhã servido diariamente durante a hospedagem.",
      icon: Coffee,
    },
    {
      title: "Ambiente familiar",
      description: "Ambiente destinado a estadias de casais e famílias.",
      icon: Trees,
    },
    {
      title: "Reserva pelo site",
      description: "Consulte disponibilidade e valores antes de escolher sua acomodação.",
      icon: CalendarCheck2,
    },
  ] as const;

  const WHATSAPP_PHONE = "5519999654866";
  const WHATSAPP_MESSAGE = "Olá! Tenho uma dúvida sobre a hospedagem. Já consultei no site, pode me ajudar?";
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  const [activeGalleryPage, setActiveGalleryPage] = useState(0);
  const [lowestOffer, setLowestOffer] = useState<HomeOfferSummary | null>(null);
  const handleLowestOfferChange = useCallback((summary: HomeOfferSummary | null) => {
    setLowestOffer(summary);
  }, []);
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
          className="container relative z-10 flex min-h-[88vh] flex-col justify-center pb-8 pt-24 sm:pb-14 sm:pt-28 lg:pb-16 lg:pt-32"
          initial={false}
          animate="visible"
          variants={containerVariants}
        >
          <div className="grid gap-8 lg:min-h-[64vh] lg:grid-cols-[minmax(0,0.82fr)_minmax(540px,1.18fr)] lg:items-center xl:gap-12">
            <motion.div
              variants={containerVariants}
              className="max-w-[34rem] space-y-5 pb-2 text-left sm:space-y-7"
            >
              <motion.p
                variants={itemVariants}
                className="font-accent text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[color:var(--brand-gold)] [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]"
              >
                Serra Negra · SP
              </motion.p>

              <motion.h1
                variants={itemVariants}
                className="font-hero-display max-w-[13ch] text-[clamp(2.4rem,5vw,4.5rem)] font-bold leading-[0.96] text-white"
              >
                Pousada em Serra Negra para descansar em família
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="max-w-[30ch] text-base leading-8 text-[color:var(--brand-white)] [text-shadow:0_1px_16px_rgba(0,0,0,0.38)] sm:text-lg"
              >
                Piscinas, café da manhã e acomodações na ala principal, chalés e anexos.
              </motion.p>

              {lowestOffer ? (
                <motion.div variants={itemVariants} className="inline-flex w-fit items-end gap-3 border-l-2 border-[color:var(--brand-gold)] bg-black/20 px-4 py-3 text-white backdrop-blur-sm">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/75">Total a partir de</p>
                    <p className="mt-1 text-3xl font-bold leading-none">
                      {lowestOffer.totalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <p className="pb-0.5 text-xs leading-5 text-white/75">
                    {formatDateBRFromYmd(lowestOffer.checkIn)} – {formatDateBRFromYmd(lowestOffer.checkOut)}
                    <br />{lowestOffer.nights} {lowestOffer.nights === 1 ? "noite" : "noites"} · 2 adultos
                  </p>
                </motion.div>
              ) : null}

              <motion.div variants={itemVariants} className="flex flex-wrap gap-3 pt-2">
                <Button asChild className="h-12 rounded-none bg-[color:var(--brand-gold)] px-6 font-sans text-sm font-semibold text-[color:var(--brand-forest)] shadow-none hover:bg-[color:var(--brand-gold)]/90">
                  <Link href="/reservar" onClick={() => trackClickReservarHero("hero")}>
                    Ver preços e disponibilidade
                  </Link>
                </Button>
                <Button asChild variant="outline" className="hidden h-12 rounded-none border-[color:var(--brand-gold)]/60 bg-[color:var(--forest-soft)] px-6 font-sans text-sm font-medium text-[color:var(--brand-white)] shadow-none transition-all duration-200 hover:-translate-y-px hover:border-[color:var(--brand-white)]/70 hover:bg-[color:var(--brand-forest)] hover:text-[color:var(--brand-white)] sm:inline-flex">
                  <Link href="/acomodacoes">
                    Conheça a pousada
                  </Link>
                </Button>
              </motion.div>

              <motion.div variants={itemVariants} className="hidden sm:block">
                <SocialProofBadges variant="hero" showTotal={false} className="mx-0" />
              </motion.div>
            </motion.div>

            <motion.div variants={itemVariants} className="w-full max-w-[430px] justify-self-start lg:justify-self-end">
              <div className="border border-white/28 bg-black/34 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl supports-[backdrop-filter]:bg-black/32">
                <div className="border-b border-white/18 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">Reserva online</p>
                    <h2 className="mt-1 text-lg font-semibold leading-tight text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.28)]">Consulte valores para sua estadia</h2>
                    <p className="mt-1 text-sm leading-5 text-white/80">Veja disponibilidade antes de reservar.</p>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <SearchWidget
                    uiPreset="hero"
                    submitLabel="Ver preços e disponibilidade"
                    submitLabelMobile="Ver preços"
                    collapsible={false}
                  />
                  <p className="pt-4 text-xs leading-5 text-white/75">
                    Valor calculado conforme datas, ocupação e acomodação disponível.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <section className="border-b border-primary/10 bg-white py-8 md:py-10">
        <div className="container mx-auto max-w-[1440px] px-4">
          <SocialProofBadges variant="light" className="mx-auto max-w-5xl" />
        </div>
      </section>

      <HomeAvailabilityOffers onLowestOfferChange={handleLowestOfferChange} />

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
            {currentGalleryPage.images.map((img) => (
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
            initial={false}
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
                Consulte a disponibilidade e escolha uma acomodação para sua estadia.
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
                Valores e disponibilidade são confirmados no motor de reservas.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
