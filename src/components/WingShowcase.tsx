"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import homeStyles from "@/components/home-novo/home-novo.module.css";
import { trackClickReservar } from "@/lib/analytics";
import { roomAcceptsPets } from "@/lib/pet-policy";
import { formatBrl } from "@/lib/room-display";

export type ShowcaseRoom = {
  id: string;
  name: string;
  capacity: number;
  maxGuests?: number;
  amenities: string[];
  photoUrl: string | null;
  fromPrice: number;
  /** Diz a que data o valor se refere (ex.: "Diária de hoje · 23/11"). */
  priceLabel: string;
};

type WingShowcaseProps = {
  index: number;
  total: number;
  title: string;
  emphasis: string;
  text: string;
  rooms: ShowcaseRoom[];
  tone: "cream" | "white";
  id: string;
  next?: { id: string; label: string };
};

// Uma ala = uma tela (desktop). Os quartos viram painéis que abrem ao passar o mouse ou focar;
// no celular cada quarto aparece completo, em lista.
export default function WingShowcase({ index, total, title, emphasis, text, rooms, tone, id, next }: WingShowcaseProps) {
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const touchedRef = useRef(false);

  const choose = (roomIndex: number) => {
    touchedRef.current = true;
    setTouched(true);
    setActive(roomIndex);
  };

  // Dica de movimento: ao entrar na tela, o painel ao lado "espia" abrir e volta (uma vez),
  // mostrando que dá para passar o mouse. Não roda com movimento reduzido nem depois de uma interação.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || rooms.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        timers.push(
          window.setTimeout(() => !touchedRef.current && setActive(1), 900),
          window.setTimeout(() => !touchedRef.current && setActive(0), 2300),
        );
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [rooms.length]);

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-label={`${title} ${emphasis}`}
      className={`${homeStyles.fit} py-10 text-[color:var(--brand-forest)] md:pb-8 md:pt-[104px] ${tone === "cream" ? "bg-[color:var(--brand-cream)]" : "bg-white"}`}
    >
      <div className="container flex min-h-0 flex-col gap-5 md:h-full">
        <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className={`${homeStyles.eyebrow} text-[color:var(--brand-forest)]`}>
              Ala {index + 1} de {total}
            </p>
            <h2 className={`${homeStyles.display} ${homeStyles.displayDark} mt-3 text-[clamp(1.9rem,min(4.6vw,7vh),3.8rem)]`}>
              {title} <em>{emphasis}</em>
            </h2>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <p className="max-w-[44ch] text-sm leading-6 text-[color:var(--brand-forest)]/75 md:text-base">{text}</p>
            {rooms.length > 1 ? (
              <p
                aria-hidden="true"
                className={`hidden items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-forest)] transition-opacity duration-500 md:inline-flex ${touched ? "opacity-0" : "opacity-100"}`}
              >
                Passe o mouse pelos quartos
                <span className="inline-block animate-[wing-nudge_1.6s_ease-in-out_infinite]">→</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 md:flex-1 md:flex-row md:gap-2">
          {rooms.map((room, roomIndex) => {
            const isActive = active === roomIndex;
            const pets = roomAcceptsPets(room.name);
            const guests =
              room.maxGuests && room.maxGuests > room.capacity
                ? `${room.capacity} hóspedes · até ${room.maxGuests} em quartos selecionados`
                : `${room.capacity} hóspedes`;

            return (
              <div
                key={room.id}
                role="group"
                aria-label={`${room.name}: ${guests}`}
                tabIndex={0}
                onMouseEnter={() => choose(roomIndex)}
                onFocus={() => choose(roomIndex)}
                style={{ "--grow": isActive ? 6 : 1 } as React.CSSProperties}
                className="group relative min-h-[300px] overflow-hidden outline-none transition-[flex] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-gold)] md:min-h-0 md:[flex:var(--grow)_1_0%]"
              >
                {room.photoUrl ? (
                  <Image
                    src={room.photoUrl}
                    alt={`Foto do ${room.name}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 70vw"
                    quality={85}
                    className="object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0.05)_30%,rgba(20,28,18,0.88)_100%)]" />

                {/* Clicar na foto leva à página do quarto (desktop: só com o painel aberto; celular: sempre) */}
                <Link
                  href={`/acomodacoes/${room.id}`}
                  tabIndex={-1}
                  aria-hidden="true"
                  className={`absolute inset-0 z-0 ${isActive ? "cursor-pointer" : "md:pointer-events-none"}`}
                />

                {/* Painel fechado (desktop): número e nome na vertical */}
                <div
                  className={`pointer-events-none absolute inset-0 hidden flex-col justify-between p-5 text-white transition-opacity duration-500 md:flex ${isActive ? "opacity-0" : "opacity-100"}`}
                  aria-hidden="true"
                >
                  <span className="text-sm font-bold text-[color:var(--brand-gold)]">{String(roomIndex + 1).padStart(2, "0")}</span>
                  <span className={`${homeStyles.display} rotate-180 text-xl [writing-mode:vertical-rl]`}>{room.name}</span>
                  <span className="absolute right-4 top-5 text-lg text-[color:var(--brand-gold)] animate-[wing-nudge_1.6s_ease-in-out_infinite]">›</span>
                </div>

                {/* Painel aberto (desktop) / sempre visível (celular) */}
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 text-white transition-all duration-700 md:p-8 ${isActive ? "md:translate-y-0 md:opacity-100" : "md:pointer-events-none md:translate-y-4 md:opacity-0"}`}
                >
                  <span className="text-sm font-bold text-[color:var(--brand-gold)]">{String(roomIndex + 1).padStart(2, "0")}</span>
                  <h3 className={`${homeStyles.display} mt-1 text-[clamp(1.8rem,min(3vw,5vh),3rem)]`}>{room.name}</h3>
                  <p className="mt-2 text-sm text-white/85">
                    {guests} · {pets ? "aceita pets de pequeno porte" : "não aceita pets"}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                    {room.amenities.slice(0, 5).map((amenity) => (
                      <li key={amenity} className="border border-white/30 px-2.5 py-1">
                        {amenity}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
                    <p>
                      <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/75">{room.priceLabel}</span>
                      <span className={`${homeStyles.display} text-[1.9rem]`}>{formatBrl(room.fromPrice)}</span>
                      <span className="ml-1 text-xs text-white/75">por noite · 2 adultos</span>
                    </p>
                    <Link
                      href={`/reservar?roomTypeId=${room.id}`}
                      onClick={() => trackClickReservar(`room_showcase_${room.id}`)}
                      className="pointer-events-auto inline-flex h-11 items-center bg-[color:var(--brand-gold)] px-6 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
                    >
                      Ver preços
                    </Link>
                    <Link
                      href={`/acomodacoes/${room.id}`}
                      className="pointer-events-auto inline-flex h-11 items-center text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-gold)] underline underline-offset-4"
                    >
                      Ver fotos e detalhes
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {next ? (
          <a
            href={`#${next.id}`}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(next.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="group flex shrink-0 items-center justify-center gap-3 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--brand-forest)] hover:text-[#7a7720]"
          >
            Veja também: {next.label}
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--brand-forest)] text-base leading-none text-[color:var(--brand-gold)] transition-transform group-hover:scale-110"
            >
              <span className="inline-block animate-[wing-bob_1.6s_ease-in-out_infinite]">↓</span>
            </span>
          </a>
        ) : null}
      </div>
    </section>
  );
}

type WingData = { title: string; emphasis: string; text: string; rooms: ShowcaseRoom[] };

// Todas as alas abertas; no pé de cada ala (menos a última) uma seta leva à próxima.
export function WingShowcaseList({ wings }: { wings: WingData[] }) {
  return (
    <>
      {wings.map((wing, index) => {
        const nextWing = wings[index + 1];
        return (
          <WingShowcase
            key={wing.emphasis}
            index={index}
            total={wings.length}
            title={wing.title}
            emphasis={wing.emphasis}
            text={wing.text}
            rooms={wing.rooms}
            tone={index % 2 === 0 ? "cream" : "white"}
            id={`ala-${index + 1}`}
            next={nextWing ? { id: `ala-${index + 2}`, label: `${nextWing.title} ${nextWing.emphasis}` } : undefined}
          />
        );
      })}
    </>
  );
}
