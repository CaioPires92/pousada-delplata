"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";

import homeStyles from "@/components/home-novo/home-novo.module.css";
import { PhotoLightbox } from "@/components/home-novo/PhotoLightbox";
import type { AreaCard } from "@/components/AreaGrid";

type AreaPanelsProps = {
  index: number;
  total: number;
  title: ReactNode;
  text: string;
  areas: readonly AreaCard[];
  tone: "cream" | "white";
};

// Uma ala = uma tela (desktop): as áreas viram painéis que abrem ao passar o mouse; clicar abre a galeria da área
// com índice em texto. No celular, cada área aparece completa, em lista.
export default function AreaPanels({ index, total, title, text, areas, tone }: AreaPanelsProps) {
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState<{ area: number; photo: number; trigger: HTMLElement | null } | null>(null);

  const close = useCallback(() => {
    setOpen((current) => {
      current?.trigger?.focus();
      return null;
    });
  }, []);
  const move = useCallback(
    (step: number) =>
      setOpen((current) => {
        if (!current) return current;
        const count = areas[current.area].photos.length;
        return { ...current, photo: (current.photo + step + count) % count };
      }),
    [areas],
  );
  const select = useCallback((photo: number) => setOpen((current) => (current ? { ...current, photo } : current)), []);

  return (
    <section
      className={`${homeStyles.fit} py-10 text-[color:var(--brand-forest)] md:pb-8 md:pt-[104px] ${tone === "cream" ? "bg-[color:var(--brand-cream)]" : "bg-white"}`}
    >
      <div className="container flex min-h-0 flex-col gap-5 md:h-full">
        <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className={`${homeStyles.eyebrow} text-[color:var(--brand-forest)]`}>
              Ala {index + 1} de {total}
            </p>
            <h2 className={`${homeStyles.display} ${homeStyles.displayDark} mt-3 text-[clamp(1.9rem,min(4.6vw,7vh),3.8rem)]`}>{title}</h2>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <p className="max-w-[44ch] text-sm leading-6 text-[color:var(--brand-forest)]/75 md:text-base">{text}</p>
            {areas.length > 1 ? (
              <p
                aria-hidden="true"
                className={`hidden items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] transition-opacity duration-500 md:inline-flex ${touched ? "opacity-0" : "opacity-100"}`}
              >
                Passe o mouse pelas áreas
                <span className="inline-block animate-[wing-nudge_1.6s_ease-in-out_infinite]">→</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 md:flex-1 md:flex-row md:gap-2">
          {areas.map((area, areaIndex) => {
            const isActive = active === areaIndex;
            const choose = () => {
              setTouched(true);
              setActive(areaIndex);
            };
            const openGallery = (trigger: HTMLElement) => setOpen({ area: areaIndex, photo: 0, trigger });

            return (
              <article
                key={area.id}
                onMouseEnter={choose}
                onFocus={choose}
                style={{ "--grow": isActive ? 5 : 1 } as React.CSSProperties}
                className="group relative min-h-[340px] overflow-hidden bg-[color:var(--brand-forest)] text-white transition-[flex] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] md:min-h-0 md:[flex:var(--grow)_1_0%]"
              >
                <Image
                  src={area.photos[0].src}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 70vw"
                  quality={82}
                  className="object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0.05)_30%,rgba(20,28,18,0.9)_100%)] max-md:bg-[linear-gradient(180deg,rgba(20,28,18,0.35)_0%,rgba(20,28,18,0.92)_70%)]" />

                <button
                  type="button"
                  aria-label={`${area.title}: ver ${area.photos.length} fotos`}
                  onClick={(event) => openGallery(event.currentTarget)}
                  className="absolute inset-0 z-0 cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--brand-gold)]"
                />

                {/* Painel fechado (desktop): nome na vertical */}
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 hidden flex-col justify-end p-5 transition-opacity duration-500 md:flex ${isActive ? "opacity-0" : "opacity-100"}`}
                >
                  <span className={`${homeStyles.display} rotate-180 text-xl [writing-mode:vertical-rl]`}>{area.title}</span>
                </div>

                <span className="pointer-events-none absolute left-4 top-4 z-10 bg-[rgba(20,28,18,0.85)] px-3 py-1.5 text-xs font-semibold">
                  {area.photos.length} fotos
                </span>

                {/* Painel aberto (desktop) / sempre visível (celular) */}
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 transition-all duration-700 md:p-7 ${isActive ? "md:translate-y-0 md:opacity-100" : "md:translate-y-4 md:opacity-0"}`}
                >
                  <h3 className={`${homeStyles.display} text-[clamp(1.7rem,min(2.8vw,5vh),2.8rem)]`}>{area.title}</h3>
                  {area.description ? <p className="mt-2 max-w-[48ch] text-sm text-white/85 md:text-base">{area.description}</p> : null}
                  <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-gold)]">
                    Ver fotos <span aria-hidden="true">→</span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {open ? <PhotoLightbox photos={areas[open.area].photos} index={open.photo} onClose={close} onMove={move} onSelect={select} /> : null}
    </section>
  );
}
