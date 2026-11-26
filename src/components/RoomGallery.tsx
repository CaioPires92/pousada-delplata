"use client";

import Image from "next/image";

import { type GalleryPhoto, usePhotoLightbox } from "@/components/home-novo/PhotoLightbox";
import { buildRoomGalleryPhotos } from "@/lib/room-gallery";

// Galeria do quarto: uma foto grande e quatro menores; qualquer uma abre a janela ampliada (setas, Esc, legenda).
export default function RoomGallery({ roomName, photoUrls }: { roomName: string; photoUrls: string[] }) {
  const photos: GalleryPhoto[] = buildRoomGalleryPhotos(roomName, photoUrls);
  const { open, lightbox } = usePhotoLightbox(photos);

  if (photos.length === 0) {
    return <div className="flex aspect-[16/9] items-center justify-center bg-[color:var(--brand-cream)] text-foreground/60">Sem fotos cadastradas</div>;
  }

  const visible = photos.slice(0, 5);
  const hidden = photos.length - visible.length;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:grid-rows-2">
        {visible.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            aria-label={`Ampliar foto ${index + 1} de ${photos.length}: ${roomName}`}
            onClick={(event) => open(index, event.currentTarget)}
            className={`group relative cursor-zoom-in overflow-hidden ${index === 0 ? "col-span-2 row-span-2 aspect-[4/3] md:aspect-auto md:min-h-[420px]" : "aspect-[4/3]"}`}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority={index === 0}
              sizes={index === 0 ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
              quality={85}
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {index === visible.length - 1 && hidden > 0 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-[rgba(20,28,18,0.6)] text-lg font-semibold text-white">+{hidden} fotos</span>
            ) : null}
          </button>
        ))}
      </div>
      {lightbox}
    </>
  );
}
