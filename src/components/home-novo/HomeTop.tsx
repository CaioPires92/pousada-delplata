"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";

import SearchWidget from "@/components/SearchWidget";
import SocialProofBadges from "@/components/SocialProofBadges";
import type { HomeOfferSummary } from "@/components/HomeAvailabilityOffers";
import { trackClickReservarHero } from "@/lib/analytics";
import { formatDateBRFromYmd } from "@/lib/date";
import styles from "./home-novo.module.css";

const HomeAvailabilityOffers = dynamic(() => import("@/components/HomeAvailabilityOffers"), {
  loading: () => <section aria-label="Ofertas disponíveis" className="min-h-[420px] bg-white" />,
});

// Hero + faixa de avaliações + ofertas. É a única parte da home que precisa de estado no navegador
// (o menor preço encontrado aparece no hero); o resto da página é renderizado no servidor.
export default function HomeTop() {
  const [lowestOffer, setLowestOffer] = useState<HomeOfferSummary | null>(null);
  const handleLowestOfferChange = useCallback((summary: HomeOfferSummary | null) => setLowestOffer(summary), []);

  return (
    <>
      <section
        data-home-hero
        className="relative flex min-h-[100svh] w-full items-end overflow-hidden bg-[color:var(--brand-black)]"
      >
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/fotos/piscina-aptos/DJI_0845.jpg"
            alt="Piscina da Pousada Delplata em Serra Negra"
            fill
            sizes="100vw"
            quality={75}
            priority
            className={`${styles.kenburns} object-cover object-center`}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,28,18,0.7)_0%,rgba(20,28,18,0.35)_55%,rgba(20,28,18,0.2)_100%),linear-gradient(180deg,rgba(20,28,18,0.5)_0%,rgba(20,28,18,0)_30%,rgba(20,28,18,0.7)_100%)]" />
        </div>

        <div className="container relative z-10 flex min-h-[100svh] flex-col justify-end gap-10 pb-10 pt-28 sm:pb-14 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,430px)] lg:items-end xl:gap-16">
            <div className={`${styles.heroIn} space-y-6`}>
              <p className={`${styles.eyebrow} ${styles.onPhoto} text-[#efe3a0]`}>Serra Negra · SP</p>

              <h1 className={`${styles.display} ${styles.onPhoto} text-[clamp(2.7rem,7.4vw,6.6rem)] text-white`}>
                Pousada em Serra Negra <em>para descansar em família</em>
              </h1>

              <p className="max-w-[44ch] text-base leading-8 text-white/90 sm:text-lg">
                Piscinas, café da manhã e acomodações na ala principal, chalés e anexos.
              </p>

              {lowestOffer ? (
                <div className="inline-flex w-fit items-end gap-3 border-l-2 border-[color:var(--brand-gold)] bg-black/25 px-4 py-3 text-white backdrop-blur-sm">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/75">Total a partir de</p>
                    <p className="mt-1 text-3xl font-bold leading-none">
                      {lowestOffer.totalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <p className="pb-0.5 text-xs leading-5 text-white/75">
                    {formatDateBRFromYmd(lowestOffer.checkIn)} – {formatDateBRFromYmd(lowestOffer.checkOut)}
                    <br />
                    {lowestOffer.nights} {lowestOffer.nights === 1 ? "noite" : "noites"} · 2 adultos
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/reservar"
                  onClick={() => trackClickReservarHero("hero")}
                  className="inline-flex h-12 items-center bg-[color:var(--brand-gold)] px-7 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
                >
                  Ver preços e disponibilidade
                </Link>
                <Link
                  href="/acomodacoes"
                  className="inline-flex h-12 items-center border border-white/50 px-7 text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-white/10"
                >
                  Conheça a pousada
                </Link>
              </div>
            </div>

            <div className="w-full">
              <div className="border border-white/28 bg-black/34 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
                <div className="border-b border-white/18 px-5 py-4 sm:px-6">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">Reserva direta</p>
                  <h2 className="mt-1 text-lg font-semibold leading-tight text-white">Consulte valores para sua estadia</h2>
                  <p className="mt-1 text-sm leading-5 text-white/80">Veja disponibilidade antes de reservar.</p>
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
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-primary/10 bg-white py-8 md:py-10">
        <div className="container mx-auto max-w-[1440px] px-4">
          <SocialProofBadges variant="light" className="mx-auto max-w-5xl" />
        </div>
      </section>

      <HomeAvailabilityOffers onLowestOfferChange={handleLowestOfferChange} />
    </>
  );
}
