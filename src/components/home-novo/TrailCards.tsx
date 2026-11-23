"use client";

import Image from "next/image";

import { type GalleryPhoto, usePhotoLightbox } from "./PhotoLightbox";
import TrackedLink from "./TrackedLink";
import styles from "./home-novo.module.css";

// Cartões da trilha horizontal: cada foto amplia com legenda; o último cartão chama para reservar.
export default function TrailCards({ photos }: { photos: readonly GalleryPhoto[] }) {
  const { open, lightbox } = usePhotoLightbox(photos);

  return (
    <>
      <div data-hscroll-track className="flex h-full w-max items-stretch gap-4 px-5 md:gap-6 md:px-[6vw]">
        {photos.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            aria-label={`Ampliar foto: ${photo.caption}`}
            onClick={(event) => open(index, event.currentTarget)}
            className="relative h-full w-[78vw] flex-none cursor-zoom-in overflow-hidden text-left md:w-[30vw]"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 768px) 90vw, 760px"
              quality={85}
              className="object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-5 text-lg font-semibold text-white">
              <span className="mr-3 text-sm font-bold text-[color:var(--brand-gold)]">{String(index + 1).padStart(2, "0")}</span>
              {photo.caption}
            </span>
          </button>
        ))}
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
      {lightbox}
    </>
  );
}
