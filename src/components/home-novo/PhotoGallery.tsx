"use client";

import Image from "next/image";

import { type GalleryPhoto, usePhotoLightbox } from "./PhotoLightbox";

// Galeria única: grade alinhada; clicar amplia a foto com a legenda do lugar.
export default function PhotoGallery({ photos }: { photos: readonly GalleryPhoto[] }) {
  const { open, lightbox } = usePhotoLightbox(photos);

  return (
    <>
      <div
        className="grid auto-rows-[200px] grid-cols-2 gap-3 md:h-full md:auto-rows-fr md:grid-cols-4 md:grid-rows-3 md:gap-4"
        data-mosaic
      >
        {photos.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            data-tile
            aria-label={`Ampliar foto: ${photo.caption}`}
            onClick={(event) => open(index, event.currentTarget)}
            className={`group relative min-h-0 cursor-zoom-in overflow-hidden text-left ${photo.className ?? ""}`}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1536px) 40vw, 760px"
              quality={85}
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10 text-sm font-semibold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
              {photo.caption}
            </span>
          </button>
        ))}
      </div>
      {lightbox}
    </>
  );
}
