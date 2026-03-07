"use client";

import { useMemo, useState } from "react";

import { motion } from "framer-motion";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SearchWidget from "@/components/SearchWidget";
import { BadgeCheck, Waves, UtensilsCrossed, ArrowRight, Coffee, Users, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  gaEvent,
  trackClickReservarHero,
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
  cta: {
    src: "/fotos/piscina-aptos/DJI_0908.jpg",
    alt: "Vista da área da piscina para reserva",
  },
} as const;



export default function HomeContent() {
  const [showPromoCard, setShowPromoCard] = useState(true);
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
      description: 'Conforto e praticidade. Inclui Apartamentos Térreo e Superior.',
      image: siteImages.accommodations.mainWing,
      link: '/acomodacoes'
    },
    {
      id: 'ala-anexo',
      title: 'Ala Chalés e Anexos',
      description: 'Privacidade e contato com a natureza. Inclui Chalés e Apartamentos Anexo.',
      image: siteImages.accommodations.annexWing,
      link: '/acomodacoes'
    }
  ];

  const quickBenefits = [
    "Piscina adulto + infantil",
    "Café da manhã diário",
    "Ambiente familiar",
    "Melhor tarifa garantida",
  ];

  const WHATSAPP_PHONE = "5519999654866";
  const WHATSAPP_MESSAGE = "Olá! Tenho uma dúvida sobre a hospedagem. Já consultei no site, pode me ajudar?";
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  const HERO_RESERVA_MICROCOPY = "Consulte disponibilidade em tempo real e garanta a melhor tarifa.";
  const RESERVA_INTERACTION_EVENT = "reservar-cta-interaction";
  const enabledSpecialDates = useMemo(
    () => SPECIAL_DATES.filter((specialDate) => specialDate.enabled),
    []
  );

  const handleHeroPrimaryCtaClick = () => {
    trackClickReservarHero("hero");
    window.dispatchEvent(new CustomEvent(RESERVA_INTERACTION_EVENT));
  };

  const handleSpecialDateClick = (specialDateId: string) => {
    gaEvent("home_special_dates_click", { special_date_id: specialDateId });
  };

  return (
    <main className="min-h-screen">

      {/* Hero Section with Background Image */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={siteImages.hero.src}
            alt={siteImages.hero.alt}
            fill
            sizes="100vw"
            className="object-cover"
            quality={82}
            priority
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-primary/40 to-primary/50" />
        </div>

        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        <motion.div
          className="container relative z-10 text-center space-y-7 pt-28 pb-28 md:py-20"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-bold font-heading leading-tight text-white">
            Pousada familiar em <span className="text-secondary">Serra Negra</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-xl md:text-3xl font-medium text-white max-w-3xl mx-auto">
            Conforto, lazer e ótima localização para sua família.
          </motion.p>

          <motion.div variants={itemVariants}>
            <SocialProofBadges className="mt-1" />
          </motion.div>

          <motion.div variants={itemVariants} className="max-w-7xl mx-auto mt-8 mb-8 md:mb-0">
            <SearchWidget
              ctaMicrocopy={HERO_RESERVA_MICROCOPY}
              onPrimaryCtaClick={handleHeroPrimaryCtaClick}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2 hidden md:block"
          >
            <div className="animate-bounce">
              <svg className="w-6 h-6 text-white/60" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
              </svg>
            </div>
          </motion.div>
        </motion.div>

      </section>

      {showPromoCard ? (
        <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-xl border border-primary/20 bg-gradient-to-r from-primary to-primary/90 text-white shadow-2xl md:top-24">
          <div className="flex items-center justify-center gap-4 px-4 py-3">
            <p className="text-sm font-medium md:text-base whitespace-nowrap">
              <span className="font-bold">15% OFF neste fim de semana.</span> Clique e garanta seu desconto.
            </p>

            <Button asChild size="sm" className="h-9 bg-white text-primary hover:bg-white/90">
              <Link href="/reservar?promo=WEEKEND15&promoLock=1">
                Garantir desconto
              </Link>
            </Button>

            <button
              type="button"
              onClick={() => setShowPromoCard(false)}
              className="rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fechar faixa promocional"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <SpecialDatesSection
        dates={enabledSpecialDates}
        onDateClick={(specialDate) => handleSpecialDateClick(specialDate.id)}
      />

      {/* Quick Benefits Section */}
      <section className="bg-background py-10 md:py-12 border-b border-border/60">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-5xl mx-auto">
            {quickBenefits.map((benefit) => (
              <Badge
                variant="secondary"
                key={benefit}
                className="group flex h-auto w-full items-center justify-start gap-2.5 rounded-full border border-border/60 bg-card/80 px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-card hover:shadow-md"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  {benefit === "Piscina adulto + infantil" ? (
                    <Waves className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : benefit === "Café da manhã diário" ? (
                    <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : benefit === "Ambiente familiar" ? (
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
                <span>{benefit}</span>
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Accommodations Section */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="text-center mb-16"
          >
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold font-heading mb-4">
              Nossas Acomodações
            </motion.h2>
            <motion.p variants={itemVariants} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Escolha o tipo de acomodação e veja disponibilidade no motor de reservas.
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {wings.map((wing, index) => (
              <motion.div
                key={wing.id}
                className="wing-card h-full"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                <Link href={wing.link} className="block h-full group">
                  <Card className="h-full overflow-hidden rounded-2xl border border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="relative w-full aspect-[16/9] overflow-hidden rounded-xl">
                      <Image
                        src={wing.image.src}
                        alt={wing.image.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <h3 className="line-clamp-1 text-2xl md:text-3xl font-bold font-heading">{wing.title}</h3>
                        <p className="mt-1 min-h-[2.75rem] line-clamp-2 text-sm md:text-base text-white/90">{wing.description}</p>
                        <div className="mt-3 flex items-center text-secondary font-bold group-hover:translate-x-1 transition-transform">
                          Ver fotos e detalhes <ArrowRight className="ml-2 w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button asChild size="lg" variant="outline" className="text-lg px-8">
              <Link href="/acomodacoes">Ver todas as acomodações e disponibilidade</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Leisure & Restaurant Section */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="relative h-64 rounded-2xl overflow-hidden mb-6">
                <Image
                  src={siteImages.leisure.src}
                  alt={siteImages.leisure.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
              </div>
              <div className="inline-block p-4 bg-primary/10 rounded-2xl">
                <Waves className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-4xl font-bold font-heading">Lazer para todos os gostos</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Pensando no seu bem estar o Hotel Pousada Delplata oferece o melhor para o seu lazer
              </p>
              <Button asChild size="lg" className="mt-4">
                <Link href="/lazer">Conheça Nossas Opções</Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="relative h-64 rounded-2xl overflow-hidden mb-6">
                <Image
                  src={siteImages.breakfast.src}
                  alt={siteImages.breakfast.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
              </div>
              <div className="inline-block p-4 bg-secondary/10 rounded-2xl">
                <UtensilsCrossed className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-4xl font-bold font-heading">Café da manhã servido em um agradável ambiente</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Preparados tudo com muito carinho para você e sua família.
              </p>
              <Button asChild size="lg" variant="secondary" className="mt-4">
                <Link href="/restaurante">Saiba Mais</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative pt-16 pb-28 md:pt-20 md:pb-24 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={siteImages.cta.src}
            alt={siteImages.cta.alt}
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-primary/90" />
        </div>
        <div className="container relative z-10 text-center text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto space-y-8"
          >
            <h2 className="text-4xl md:text-5xl font-bold font-heading">
              Pronto para sua próxima aventura?
            </h2>
            <p className="text-xl text-white/90">
              Reserve agora e garanta os melhores momentos com sua família
            </p>
            <div className="flex flex-col items-center gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 justify-center">
                <Button asChild size="lg" className="h-12 text-lg px-8 bg-white text-primary hover:bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.35)]">
                  <Link href="/reservar" onClick={() => trackClickReservarFinal("final")}>
                    Fazer reserva agora
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 text-lg px-8 bg-white/10 border-white text-white hover:bg-white hover:text-primary">
                  <Link
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackClickWhatsAppFinal("final")}
                  >
                    Tirar dúvidas no WhatsApp
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-white/90 text-center">
                Fins de semana e feriados têm alta procura.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
