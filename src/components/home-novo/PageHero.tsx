import Image from "next/image";
import type { ReactNode } from "react";

import styles from "./home-novo.module.css";

type PageHeroProps = {
  eyebrow: string;
  /** Use <em> para o trecho em itálico (ex.: <>Fale <em>conosco</em></>). */
  title: ReactNode;
  text?: string;
  /** Sem foto, o cabeçalho usa o fundo verde da marca. */
  image?: string;
  imageAlt?: string;
};

// Cabeçalho das páginas internas, no mesmo desenho da home: rótulo, título em fonte de título com itálico, foto ou fundo verde.
export default function PageHero({ eyebrow, title, text, image, imageAlt = "" }: PageHeroProps) {
  return (
    <section
      data-page-hero
      className="relative flex min-h-[42vh] items-end overflow-hidden bg-[color:var(--brand-forest)] md:min-h-[46vh]"
    >
      {image ? (
        <div className="absolute inset-0">
          <Image src={image} alt={imageAlt} fill priority sizes="100vw" quality={82} className="object-cover object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0.55)_0%,rgba(20,28,18,0.25)_40%,rgba(20,28,18,0.88)_100%)]" />
        </div>
      ) : null}
      <div className="container relative z-10 pb-10 pt-36 text-white md:pb-14">
        <p className={`${styles.eyebrow} ${image ? styles.onPhoto : ""} text-[#efe3a0]`}>{eyebrow}</p>
        <h1 className={`${styles.display} ${image ? styles.onPhoto : ""} mt-4 max-w-4xl text-[clamp(2.4rem,6vw,4.8rem)] text-white`}>{title}</h1>
        {text ? <p className="mt-4 max-w-2xl text-base leading-8 text-white/88 md:text-lg">{text}</p> : null}
      </div>
    </section>
  );
}
