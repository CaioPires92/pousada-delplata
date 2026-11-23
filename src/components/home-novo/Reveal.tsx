"use client";

import { useEffect } from "react";

// Animações de rolagem (GSAP + ScrollTrigger) carregadas só no navegador e só se o visitante
// não pediu "reduzir movimento". Sem JavaScript, tudo continua visível.
export default function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let revert: (() => void) | undefined;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    const start = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
          gsap.from(element, {
            y: 40,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: element, start: "top 88%", once: true },
          });
        });

        // Mosaico: as fotos entram em lote, levemente giradas.
        gsap.utils.toArray<HTMLElement>("[data-mosaic]").forEach((mosaic) => {
          gsap.from(mosaic.querySelectorAll("[data-tile]"), {
            y: 70,
            opacity: 0,
            rotate: () => gsap.utils.random(-5, 5),
            duration: 1,
            ease: "power3.out",
            stagger: 0.09,
            scrollTrigger: { trigger: mosaic, start: "top 85%", once: true },
          });
        });

        // Zoom: a moldura da foto abre conforme a rolagem.
        gsap.utils.toArray<HTMLElement>("[data-zoom]").forEach((section) => {
          const frame = section.querySelector<HTMLElement>("[data-zoom-frame]");
          if (!frame) return;
          gsap.fromTo(
            frame,
            { clipPath: "inset(14% 14% 14% 14% round 28px)", scale: 1.15 },
            {
              clipPath: "inset(0% 0% 0% 0% round 0px)",
              scale: 1,
              ease: "none",
              scrollTrigger: { trigger: section, start: "top 85%", end: "top 15%", scrub: true },
            },
          );
        });

        // Trilha horizontal: no desktop a rolagem vertical empurra as fotos para o lado.
        const media = gsap.matchMedia();
        media.add("(min-width: 900px)", () => {
          gsap.utils.toArray<HTMLElement>("[data-hscroll]").forEach((section) => {
            const track = section.querySelector<HTMLElement>("[data-hscroll-track]");
            if (!track) return;
            // Sem JavaScript (ou com "reduzir movimento") a trilha continua rolável com o dedo/mouse.
            gsap.set(section, { overflowX: "hidden" });
            const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
            gsap.to(track, {
              x: () => -distance(),
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top top",
                end: () => `+=${distance()}`,
                pin: true,
                scrub: true,
                invalidateOnRefresh: true,
              },
            });
          });
        });

        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((element) => {
          gsap.fromTo(
            element,
            { yPercent: -8 },
            {
              yPercent: 8,
              ease: "none",
              scrollTrigger: {
                trigger: element.parentElement,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );
        });
      });
      revert = () => ctx.revert();
    };

    // Só depois que a página ficou ociosa: o GSAP não pode competir com o carregamento do topo.
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => void start(), { timeout: 3000 });
    } else {
      timeoutHandle = window.setTimeout(() => void start(), 1500);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
      revert?.();
    };
  }, []);

  return null;
}
