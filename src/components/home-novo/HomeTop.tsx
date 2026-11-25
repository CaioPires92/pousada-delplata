"use client";

import { Suspense } from "react";
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

/** "hoje" ou "25/11": diz a data do menor preço, que pode não ser a da barra quando hoje está sem vaga. */
function offerDateLabel(checkIn: string) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return checkIn === todayKey ? "hoje" : `em ${formatDateBRFromYmd(checkIn).slice(0, 5)}`;
}

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
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0.45)_0%,rgba(20,28,18,0)_20%,rgba(20,28,18,0.1)_38%,rgba(20,28,18,0.86)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,28,18,0.6)_0%,rgba(20,28,18,0.25)_45%,rgba(20,28,18,0)_75%)]" />
        </div>

        <div className="container relative z-10 flex min-h-[100svh] flex-col justify-end pb-8 pt-28 sm:pb-12">
          <div className={`${styles.heroIn} max-w-4xl space-y-5`}>
            <h1 className={`${styles.display} ${styles.onPhoto} text-[clamp(2rem,4.3vw,4rem)] text-white`}>
              <span className="block sm:whitespace-nowrap">Pousada em Serra Negra</span>
              <em className="block">para descansar em família</em>
            </h1>

            <p className={`${styles.onPhoto} max-w-[46ch] text-base leading-7 text-white sm:text-lg`}>
              Piscinas, café da manhã, chalés e anexos.
            </p>
          </div>

          {/* Busca em barra, colada na base do topo: o visitante já começa a reservar aqui. */}
          <div className="mt-6 max-w-[980px]" onClickCapture={() => trackClickReservarHero("hero")}>
            {/* useSearchParams exige Suspense: só a busca fica de fora do HTML do servidor, o título do hero não. */}
            <Suspense fallback={<div aria-hidden="true" className="h-[92px] w-full bg-white/10" />}>
              <SearchWidget
                uiPreset="hero"
                heroLayout="horizontal"
                submitLabel="Ver preços e disponibilidade"
                submitLabelMobile="Ver preços"
                collapsible={false}
              />
            </Suspense>
            <p className={`${styles.onPhoto} mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/90`}>
              {lowestOffer ? (
                <span>
                  A partir de{" "}
                  <strong className="text-sm text-white">
                    {lowestOffer.totalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </strong>{" "}
                  por {lowestOffer.nights} {lowestOffer.nights === 1 ? "noite" : "noites"}, {offerDateLabel(lowestOffer.checkIn)}, 2 adultos
                </span>
              ) : (
                <span>Valor calculado conforme datas, ocupação e acomodação disponível.</span>
              )}
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
