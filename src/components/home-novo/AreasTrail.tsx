"use client";

import { useCallback, useState } from "react";
import Image from "next/image";

import { type GalleryPhoto, PhotoLightbox } from "./PhotoLightbox";
import TrackedLink from "./TrackedLink";
import styles from "./home-novo.module.css";

export type GalleryArea = {
  id: string;
  title: string;
  /** Linha curta sob o título (ex.: "Hotel e chalés"). */
  note?: string;
  /** Foto da capa (a primeira da lista, se não for informada). */
  cover?: string;
  photos: readonly GalleryPhoto[];
};

// Trilha horizontal de áreas da pousada: cada cartão abre a galeria só daquela área,
// com a legenda de cada foto dizendo se é do hotel ou dos chalés. O último cartão chama para reservar.
export default function AreasTrail({ areas }: { areas: readonly GalleryArea[] }) {
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
        const total = areas[current.area].photos.length;
        return { ...current, photo: (current.photo + step + total) % total };
      }),
    [areas],
  );

  const select = useCallback(
    (photo: number) => setOpen((current) => (current ? { ...current, photo } : current)),
    [],
  );

  return (
    <>
      <div data-hscroll-track className="flex h-full w-max items-stretch gap-4 px-5 md:gap-6 md:px-[6vw]">
        {areas.map((area, index) => {
          const cover = area.cover ?? area.photos[0]?.src;
          const count = area.photos.length;
          return (
            <button
              key={area.id}
              type="button"
              aria-label={`${area.title}: ver ${count} fotos`}
              onClick={(event) => setOpen({ area: index, photo: 0, trigger: event.currentTarget })}
              className="group relative h-full w-[78vw] flex-none cursor-zoom-in overflow-hidden text-left md:w-[30vw]"
            >
              {cover ? (
                <Image
                  src={cover}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 90vw, 760px"
                  quality={85}
                  className="object-cover transition-transform duration-1000 group-hover:scale-105"
                />
              ) : null}
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <span className="absolute right-4 top-4 bg-[rgba(20,28,18,0.85)] px-3 py-1.5 text-xs font-semibold text-white">
                {count} fotos
              </span>
              <span className="absolute inset-x-0 bottom-0 p-5 text-white md:p-6">
                <span className="block text-sm font-bold text-[color:var(--brand-gold)]">{String(index + 1).padStart(2, "0")}</span>
                <span className={`${styles.display} mt-1 block text-[clamp(1.6rem,2.6vw,2.4rem)]`}>{area.title}</span>
                {area.note ? <span className="mt-1 block text-sm text-white/80">{area.note}</span> : null}
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-gold)]">
                  Ver fotos <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
              </span>
            </button>
          );
        })}
        <article className="flex h-full w-[78vw] flex-none flex-col items-start justify-center gap-6 border border-white/20 p-8 md:w-[26vw]">
          <p className={`${styles.display} text-[clamp(2rem,3.4vw,3.2rem)] text-white`}>
            Sua vez <em>de vir.</em>
          </p>
          <TrackedLink
            href="/reservar"
            track="reservar_final"
            className="inline-flex h-12 items-center bg-[color:var(--brand-gold)] px-7 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
          >
            Reservar agora
          </TrackedLink>
        </article>
      </div>
      {open ? <PhotoLightbox photos={areas[open.area].photos} index={open.photo} onClose={close} onMove={move} onSelect={select} /> : null}
    </>
  );
}
