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
        // IMPORTANTE: as seções fixas (pin) são registradas primeiro e na ordem em que aparecem na página
        // (trilha, depois zoom). O ScrollTrigger soma o espaço de cada pin às seções de baixo; registrar
        // fora de ordem deixa faixas em branco e seções sobrepostas.
        // Trilha horizontal: no desktop a seção fica fixa e a rolagem vertical empurra as fotos para o lado.
        const media = gsap.matchMedia();
        media.add("(min-width: 900px) and (min-height: 560px)", () => {
          gsap.utils.toArray<HTMLElement>("[data-hscroll-section]").forEach((section) => {
            const wrapper = section.querySelector<HTMLElement>("[data-hscroll]");
            const track = section.querySelector<HTMLElement>("[data-hscroll-track]");
            if (!wrapper || !track) return;
            // Sem JavaScript (ou com "reduzir movimento") a trilha continua rolável com o dedo/mouse.
            gsap.set(wrapper, { overflowX: "hidden" });
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

        // Zoom: a moldura abre conforme a rolagem, com a seção fixa (continua com 100vh).
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
              scrollTrigger: { trigger: section, start: "top top", end: "+=70%", pin: true, scrub: true },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
          gsap.from(element, {
            y: 40,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: element, start: "top 88%", once: true },
          });
        });

        // Galeria: as fotos entram em lote, de baixo para cima.
        gsap.utils.toArray<HTMLElement>("[data-mosaic]").forEach((mosaic) => {
          gsap.from(mosaic.querySelectorAll("[data-tile]"), {
            y: 70,
            opacity: 0,
            duration: 1,
            ease: "power3.out",
            stagger: 0.09,
            scrollTrigger: { trigger: mosaic, start: "top 85%", once: true },
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
      // Recalcula as posições depois que as imagens terminam de carregar.
      if (document.readyState === "complete") ScrollTrigger.refresh();
      else window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
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
