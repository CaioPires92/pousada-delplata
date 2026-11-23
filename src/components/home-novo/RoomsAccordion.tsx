"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { roomAcceptsPets } from "@/lib/pet-policy";
import { getLocalRoomPhotos } from "@/lib/room-photos";
import TrackedLink from "./TrackedLink";
import styles from "./home-novo.module.css";

type Room = { name: string; guests: number; amenities: string[] };

// Fotos vêm do mapeamento oficial por tipo de quarto (`getLocalRoomPhotos`): cada quarto mostra a própria foto.
const ROOMS: readonly Room[] = [
  { name: "Apartamento Térreo", guests: 4, amenities: ["TV Smart", "Ar-condicionado", "Ventilador de teto"] },
  { name: "Apartamento Superior", guests: 4, amenities: ["TV", "Ar-condicionado", "Ventilador de teto"] },
  { name: "Chalé", guests: 4, amenities: ["TV", "WiFi", "Ventilador de teto"] },
  { name: "Apartamento Anexo", guests: 3, amenities: ["TV Smart", "WiFi", "Ventilador de teto"] },
];

// Painéis que se abrem ao passar o mouse ou focar (desktop); no celular cada quarto aparece completo, em lista.
export default function RoomsAccordion() {
  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-3 md:h-full md:min-h-0 md:flex-row md:gap-2">
      {ROOMS.map((room, index) => {
        const photo = getLocalRoomPhotos(room.name)?.[0] ?? null;
        const isActive = active === index;
        const pets = roomAcceptsPets(room.name);

        return (
          <div
            key={room.name}
            tabIndex={0}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            style={{ "--grow": isActive ? 6 : 1 } as React.CSSProperties}
            className="group relative min-h-[260px] overflow-hidden outline-none transition-[flex] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-gold)] md:min-h-0 md:[flex:var(--grow)_1_0%]"
          >
            {photo ? (
              <Image
                src={photo}
                alt={`Foto do ${room.name}`}
                fill
                sizes="(max-width: 768px) 100vw, 60vw"
                quality={85}
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0.1)_30%,rgba(20,28,18,0.85)_100%)]" />

            {/* Painel fechado (desktop): número e nome na vertical */}
            <div
              className={`absolute inset-0 hidden flex-col justify-between p-5 text-white transition-opacity duration-500 md:flex ${isActive ? "opacity-0" : "opacity-100"}`}
              aria-hidden="true"
            >
              <span className="text-sm font-bold text-[color:var(--brand-gold)]">{String(index + 1).padStart(2, "0")}</span>
              <span className={`${styles.display} text-xl [writing-mode:vertical-rl] rotate-180`}>{room.name}</span>
            </div>

            {/* Painel aberto (desktop) / sempre visível (celular) */}
            <div
              className={`absolute inset-x-0 bottom-0 p-6 text-white transition-all duration-700 md:p-8 ${isActive ? "md:translate-y-0 md:opacity-100" : "md:pointer-events-none md:translate-y-4 md:opacity-0"}`}
            >
              <span className="text-sm font-bold text-[color:var(--brand-gold)]">{String(index + 1).padStart(2, "0")}</span>
              <h3 className={`${styles.display} mt-1 text-[clamp(1.8rem,min(3vw,5vh),3rem)]`}>{room.name}</h3>
              <p className="mt-2 text-sm text-white/85">
                Até {room.guests} hóspedes · {pets ? "aceita pets de pequeno porte" : "não aceita pets"}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                {room.amenities.map((amenity) => (
                  <li key={amenity} className="border border-white/30 px-2.5 py-1">
                    {amenity}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <TrackedLink
                  href="/reservar"
                  track="reservar_final"
                  className="inline-flex h-11 items-center bg-[color:var(--brand-gold)] px-6 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
                >
                  Ver preços
                </TrackedLink>
                <Link href="/acomodacoes" className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-gold)] underline underline-offset-4">
                  Ver fotos e detalhes
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
