"use client";

import { useState } from "react";
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
};

type WingShowcaseProps = {
  index: number;
  total: number;
  title: string;
  emphasis: string;
  text: string;
  rooms: ShowcaseRoom[];
  tone: "cream" | "white";
};

// Uma ala = uma tela (desktop). Os quartos viram painéis que abrem ao passar o mouse ou focar;
// no celular cada quarto aparece completo, em lista.
export default function WingShowcase({ index, total, title, emphasis, text, rooms, tone }: WingShowcaseProps) {
  const [active, setActive] = useState(0);

  return (
    <section
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
          <p className="max-w-[44ch] text-sm leading-6 text-[color:var(--brand-forest)]/75 md:text-base">{text}</p>
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
                onMouseEnter={() => setActive(roomIndex)}
                onFocus={() => setActive(roomIndex)}
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

                {/* Painel fechado (desktop): número e nome na vertical */}
                <div
                  className={`absolute inset-0 hidden flex-col justify-between p-5 text-white transition-opacity duration-500 md:flex ${isActive ? "opacity-0" : "opacity-100"}`}
                  aria-hidden="true"
                >
                  <span className="text-sm font-bold text-[color:var(--brand-gold)]">{String(roomIndex + 1).padStart(2, "0")}</span>
                  <span className={`${homeStyles.display} rotate-180 text-xl [writing-mode:vertical-rl]`}>{room.name}</span>
                </div>

                {/* Painel aberto (desktop) / sempre visível (celular) */}
                <div
                  className={`absolute inset-x-0 bottom-0 p-5 text-white transition-all duration-700 md:p-8 ${isActive ? "md:translate-y-0 md:opacity-100" : "md:pointer-events-none md:translate-y-4 md:opacity-0"}`}
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
                      <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/75">A partir de</span>
                      <span className={`${homeStyles.display} text-[1.9rem]`}>{formatBrl(room.fromPrice)}</span>
                      <span className="ml-1 text-xs text-white/75">por noite</span>
                    </p>
                    <Link
                      href={`/reservar?roomTypeId=${room.id}`}
                      onClick={() => trackClickReservar(`room_showcase_${room.id}`)}
                      className="inline-flex h-11 items-center bg-[color:var(--brand-gold)] px-6 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
                    >
                      Ver preços
                    </Link>
                    <Link
                      href={`/acomodacoes/${room.id}`}
                      className="inline-flex h-11 items-center text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-gold)] underline underline-offset-4"
                    >
                      Ver fotos e detalhes
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
