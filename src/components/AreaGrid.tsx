"use client";

import { useCallback, useState } from "react";
import Image from "next/image";

import homeStyles from "@/components/home-novo/home-novo.module.css";
import { type GalleryPhoto, PhotoLightbox } from "@/components/home-novo/PhotoLightbox";

export type AreaCard = {
  id: string;
  title: string;
  description?: string;
  photos: readonly GalleryPhoto[];
};

// Grade de áreas (lazer, restaurante): cada cartão abre a galeria só daquela área, com índice em texto na lateral.
export default function AreaGrid({ areas, columns = 3 }: { areas: readonly AreaCard[]; columns?: 2 | 3 }) {
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
  const select = useCallback((photo: number) => setOpen((current) => (current ? { ...current, photo } : current)), []);

  return (
    <>
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 ${columns === 3 ? "lg:grid-cols-3" : ""}`}>
        {areas.map((area, index) => (
          <button
            key={area.id}
            type="button"
            aria-label={`${area.title}: ver ${area.photos.length} fotos`}
            onClick={(event) => setOpen({ area: index, photo: 0, trigger: event.currentTarget })}
            className="group relative aspect-[4/3] cursor-zoom-in overflow-hidden bg-[color:var(--brand-forest)] text-left"
          >
            <Image
              src={area.photos[0].src}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              quality={82}
              className="object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <span className="absolute right-3 top-3 bg-[rgba(20,28,18,0.85)] px-3 py-1.5 text-xs font-semibold text-white">
              {area.photos.length} fotos
            </span>
            <span className="absolute inset-x-0 bottom-0 p-5 text-white">
              <span className={`${homeStyles.display} block text-[clamp(1.4rem,2.2vw,2rem)]`}>{area.title}</span>
              {area.description ? <span className="mt-1 block text-sm text-white/85">{area.description}</span> : null}
              <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-gold)]">
                Ver fotos <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      {open ? <PhotoLightbox photos={areas[open.area].photos} index={open.photo} onClose={close} onMove={move} onSelect={select} /> : null}
    </>
  );
}
