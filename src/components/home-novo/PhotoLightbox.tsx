"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type GalleryPhoto = {
  src: string;
  alt: string;
  /** Legenda mostrada na foto ampliada: de onde é a foto. */
  caption: string;
  /** Classes do tile no grid (tamanho/posição). */
  className?: string;
};

// Estado + janela de foto ampliada, compartilhados pela galeria e pela trilha de fotos.
export function usePhotoLightbox(photos: readonly GalleryPhoto[]) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const open = useCallback((index: number, trigger?: HTMLElement | null) => {
    lastTrigger.current = trigger ?? null;
    setOpenIndex(index);
  }, []);
  const close = useCallback(() => {
    setOpenIndex(null);
    lastTrigger.current?.focus();
  }, []);
  const move = useCallback(
    (step: number) => setOpenIndex((current) => (current === null ? current : (current + step + photos.length) % photos.length)),
    [photos.length],
  );

  const lightbox = openIndex !== null ? (
    <PhotoLightbox photos={photos} index={openIndex} onClose={close} onMove={move} onSelect={setOpenIndex} />
  ) : null;

  return { open, lightbox };
}

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onMove,
  onSelect,
}: {
  photos: readonly GalleryPhoto[];
  index: number;
  onClose: () => void;
  onMove: (step: number) => void;
  /** Quando informado (e há mais de uma foto), mostra o índice em texto na lateral. */
  onSelect?: (index: number) => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const current = photos[index];
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  // Mantém o item ativo à vista no índice quando se troca de foto pelas setas.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [index]);

  // Índice agrupado por legenda (ex.: "Piscina do hotel" x "Piscina dos chalés").
  const groups: Array<{ caption: string; items: Array<{ index: number; photo: GalleryPhoto }> }> = [];
  photos.forEach((photo, photoIndex) => {
    const last = groups[groups.length - 1];
    if (last && last.caption === photo.caption) last.items.push({ index: photoIndex, photo });
    else groups.push({ caption: photo.caption, items: [{ index: photoIndex, photo }] });
  });
  const showIndex = Boolean(onSelect) && photos.length > 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") onMove(1);
      else if (event.key === "ArrowLeft") onMove(-1);
      else if (event.key === "Tab") {
        // Prende o foco dentro da janela: Tab/Shift+Tab circulam entre fechar, anterior e próxima.
        const buttons = dialogRef.current?.querySelectorAll<HTMLElement>("button");
        if (!buttons || buttons.length === 0) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onMove]);

  // Vai para o <body>: dentro da trilha animada (com transform) a janela ficaria presa e abaixo do cabeçalho.
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ampliada: ${current.caption}`}
      className="fixed inset-0 z-[80] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6" onClick={(event) => event.stopPropagation()}>
        <span className="text-sm text-white/75" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar foto ampliada"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
      <div className="relative mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 sm:px-16" onClick={(event) => event.stopPropagation()}>
        {/* Foto ampliada em alta qualidade (a miniatura usa uma versão menor). */}
        <Image key={current.src} src={current.src} alt={current.alt} fill sizes="100vw" quality={88} className="object-contain" priority />
        <button
          type="button"
          onClick={() => onMove(-1)}
          aria-label="Foto anterior"
          className="absolute left-1 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/80 sm:left-3"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          aria-label="Próxima foto"
          className="absolute right-1 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/80 sm:right-3"
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      {showIndex ? (
        <nav
          aria-label="Índice de fotos"
          onClick={(event) => event.stopPropagation()}
          className="hidden w-80 shrink-0 overflow-y-auto border-l border-white/10 px-4 py-4 text-white lg:block"
        >
          {groups.map((group) => {
            const multi = group.items.length > 1;
            return (
              <div key={`${group.caption}-${group.items[0].index}`} className="mb-4">
                {multi ? (
                  <p className="mb-1 px-3 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#efe3a0]">{group.caption}</p>
                ) : null}
                <ul>
                  {group.items.map(({ index: itemIndex, photo }) => {
                    const isActive = itemIndex === index;
                    return (
                      <li key={photo.src}>
                        <button
                          type="button"
                          ref={isActive ? activeItemRef : undefined}
                          aria-current={isActive ? "true" : undefined}
                          onMouseEnter={() => onSelect?.(itemIndex)}
                          onFocus={() => onSelect?.(itemIndex)}
                          onClick={() => onSelect?.(itemIndex)}
                          className={`flex w-full items-baseline gap-3 border-l-2 px-3 py-2 text-left text-sm transition-colors ${
                            isActive ? "border-[#efe3a0] bg-white/10 font-semibold text-white" : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <span className="text-xs tabular-nums text-[#efe3a0]">{String(itemIndex + 1).padStart(2, "0")}</span>
                          <span>{multi ? photo.alt : photo.caption}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      ) : null}
      </div>

      <p className="px-4 py-5 text-center text-base font-semibold text-white sm:text-lg" onClick={(event) => event.stopPropagation()}>
        {current.caption}
      </p>
    </div>,
    document.body,
  );
}
