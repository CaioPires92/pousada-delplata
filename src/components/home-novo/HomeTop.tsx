"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";

import SearchWidget from "@/components/SearchWidget";
import ProofStrip from "./ProofStrip";
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
          {/* Foto viva: escurece só o topo (menu) e a base (texto e busca). */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0.45)_0%,rgba(20,28,18,0)_22%,rgba(20,28,18,0)_45%,rgba(20,28,18,0.78)_100%)]" />
        </div>

        <div className="container relative z-10 flex min-h-[100svh] flex-col justify-end pb-8 pt-28 sm:pb-12">
          <div className={`${styles.heroIn} max-w-4xl space-y-5`}>
            <p className={`${styles.eyebrow} ${styles.onPhoto} text-[#efe3a0]`}>Serra Negra · SP</p>

            <h1 className={`${styles.display} ${styles.onPhoto} text-[clamp(2.2rem,5.4vw,5rem)] text-white`}>
              <span className="block sm:whitespace-nowrap">Pousada em Serra Negra</span>
              <em className="block">para descansar em família</em>
            </h1>

            <p className={`${styles.onPhoto} max-w-[46ch] text-base leading-7 text-white sm:text-lg`}>
              Piscinas, café da manhã e acomodações na ala principal, chalés e anexos.
            </p>

            {lowestOffer ? (
              <p className={`${styles.onPhoto} text-sm text-white/90`}>
                Total a partir de{" "}
                <strong className="text-lg text-white">
                  {lowestOffer.totalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>{" "}
                · {formatDateBRFromYmd(lowestOffer.checkIn)} – {formatDateBRFromYmd(lowestOffer.checkOut)} ·{" "}
                {lowestOffer.nights} {lowestOffer.nights === 1 ? "noite" : "noites"} · 2 adultos
              </p>
            ) : null}
          </div>

          {/* Busca em barra, colada na base do topo: o visitante já começa a reservar aqui. */}
          <div className="mt-8" onClickCapture={() => trackClickReservarHero("hero")}>
            <SearchWidget
              uiPreset="hero"
              heroLayout="horizontal"
              submitLabel="Ver preços e disponibilidade"
              submitLabelMobile="Ver preços"
              collapsible={false}
            />
            <p className={`${styles.onPhoto} mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85`}>
              <span>Valor calculado conforme datas, ocupação e acomodação disponível.</span>
              <Link href="/acomodacoes" className="font-semibold underline underline-offset-4">
                Conheça a pousada
              </Link>
            </p>
          </div>
        </div>
      </section>

      <ProofStrip />

      <HomeAvailabilityOffers onLowestOfferChange={handleLowestOfferChange} />
    </>
  );
}
