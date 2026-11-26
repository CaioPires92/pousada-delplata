"use client";

import Image from "next/image";

import {
  buildRomanticDecorWhatsAppUrl,
  ROMANTIC_DECOR_ITEMS,
  ROMANTIC_DECOR_PHOTOS,
  ROMANTIC_DECOR_PRICE_LABEL,
} from "@/constants/romanticDecor";
import { usePhotoLightbox } from "./PhotoLightbox";
import styles from "./home-novo.module.css";

// Seção romântica: foto grande (abre a galeria), texto curto, o que inclui e o preço. Uma tela no desktop.
export default function RomanticSection() {
  const photos = ROMANTIC_DECOR_PHOTOS;
  const { open, lightbox } = usePhotoLightbox(photos);
  const thumbs = photos.slice(1, 4);

  return (
    <section id="romantico" className={`${styles.fit} relative bg-[color:var(--brand-cream)] py-10 text-[color:var(--brand-forest)] md:pb-8 md:pt-[104px]`}>
      <div className="container grid min-h-0 gap-8 md:h-full md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-stretch md:gap-14">
        <div className="grid min-h-0 gap-3 max-md:order-2 md:grid-cols-[minmax(0,1fr)_minmax(0,0.34fr)] md:grid-rows-1">
          <button
            type="button"
            aria-label={`Ampliar fotos da decoração romântica (${photos.length} fotos)`}
            onClick={(event) => open(0, event.currentTarget)}
            className="group relative min-h-[320px] cursor-zoom-in overflow-hidden bg-[color:var(--brand-forest)] md:min-h-0"
          >
            <Image
              src={photos[0].src}
              alt={photos[0].alt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={82}
              className="object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-left text-xs font-semibold text-white">
              Foto no apartamento Superior. A decoração pode ser feita em qualquer acomodação.
            </span>
          </button>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-1 md:grid-rows-3">
            {thumbs.map((photo, index) => (
              <button
                key={photo.src}
                type="button"
                aria-label={`Ampliar foto ${index + 2} de ${photos.length}`}
                onClick={(event) => open(index + 1, event.currentTarget)}
                className="group relative aspect-[4/3] cursor-zoom-in overflow-hidden bg-[color:var(--brand-forest)] md:aspect-auto md:min-h-0"
              >
                <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 768px) 33vw, 16vw" quality={76} className="object-cover transition-transform duration-700 group-hover:scale-105" />
                {index === thumbs.length - 1 && photos.length > 4 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-[rgba(20,28,18,0.6)] text-sm font-bold text-white">
                    +{photos.length - 4} {photos.length - 4 === 1 ? "foto" : "fotos"}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-col justify-center gap-6 max-md:order-1">
          <div>
            <p className={`${styles.eyebrow} text-[color:var(--brand-forest)]`}>Para os casais</p>
            <h2 className={`${styles.display} ${styles.displayDark} mt-3 text-[clamp(1.9rem,min(4.6vw,7vh),3.8rem)]`}>
              Uma noite <em>romântica</em>
            </h2>
          </div>
          <p className="max-w-[46ch] text-base leading-7 text-[color:var(--brand-forest)]/80">
            Peça a decoração e encontre o quarto arrumado para uma ocasião especial. Pode ser feita em qualquer acomodação.
          </p>
          <ul className="grid gap-2 text-sm font-semibold sm:grid-cols-2">
            {ROMANTIC_DECOR_ITEMS.map((item) => (
              <li key={item} className="relative pl-5 before:absolute before:left-0 before:top-[0.55em] before:h-2 before:w-2 before:bg-[color:var(--brand-gold)]">
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-4">
            <p className={`${styles.display} text-[clamp(2rem,4vw,3rem)]`}>
              {ROMANTIC_DECOR_PRICE_LABEL}
              <span className="ml-2 text-sm font-normal normal-case tracking-normal text-[color:var(--brand-forest)]/70">por decoração</span>
            </p>
            <a
              href={buildRomanticDecorWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center bg-[color:var(--brand-forest)] px-7 text-sm font-bold uppercase tracking-[0.08em] text-white transition-opacity hover:opacity-90"
            >
              Pedir a decoração
            </a>
          </div>
          <p className="text-xs leading-5 text-[color:var(--brand-forest)]/70">
            Combinado com a pousada pelo WhatsApp, antes da chegada. Não entra no valor da reserva feita no site.
          </p>
        </div>
      </div>
      {lightbox}
    </section>
  );
}
