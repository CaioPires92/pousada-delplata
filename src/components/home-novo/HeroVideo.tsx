"use client";

import { useEffect, useState } from "react";

type HeroVideoProps = {
  desktopSrc: string;
  mobileSrc: string;
  className?: string;
};

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

/** Só toca vídeo quando faz sentido: sem pedido de menos movimento, sem economia de dados e sem conexão lenta. */
export function shouldPlayBackgroundVideo(
  reducedMotion: boolean,
  connection?: NetworkInfo | null,
) {
  if (reducedMotion) return false;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /^(slow-2g|2g|3g)$/.test(connection.effectiveType)) return false;
  return true;
}

// Vídeo de fundo do topo: entra com um fade por cima da foto (que continua no HTML, para o Google e para o carregamento).
// Celular recebe o arquivo vertical; computador, o horizontal.
export default function HeroVideo({ desktopSrc, mobileSrc, className = "" }: HeroVideoProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection;
    if (!shouldPlayBackgroundVideo(reduced, connection)) return;
    setSrc(window.matchMedia("(min-width: 768px)").matches ? desktopSrc : mobileSrc);
  }, [desktopSrc, mobileSrc]);

  if (!src) return null;

  return (
    <video
      key={src}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
      className={`${className} transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}
    />
  );
}
