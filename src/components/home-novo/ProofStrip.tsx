import type { IconType } from "react-icons";
import { SiBookingdotcom, SiGoogle, SiTripadvisor } from "react-icons/si";

import {
  HOTEL_EXPERIENCE_LABEL,
  SOCIAL_PROOF_RATINGS,
  SOCIAL_PROOF_TOTAL_LABEL,
} from "@/constants/socialProof";
import styles from "./home-novo.module.css";

type ProofItem = {
  icon?: IconType;
  value: string;
  label: string;
  detail: string;
};

const score = (value: number) => value.toFixed(1).replace(".", ",");
const reviews = (value: number) => `${new Intl.NumberFormat("pt-BR").format(value)} avaliações`;

// Faixa de prova social no mesmo desenho do resto da home: fundo verde, números grandes em dourado.
export default function ProofStrip() {
  const items: ProofItem[] = [
    { icon: SiGoogle, value: score(SOCIAL_PROOF_RATINGS.google.score), label: "Google", detail: reviews(SOCIAL_PROOF_RATINGS.google.reviews) },
    { icon: SiBookingdotcom, value: score(SOCIAL_PROOF_RATINGS.booking.score), label: "Booking", detail: reviews(SOCIAL_PROOF_RATINGS.booking.reviews) },
    { icon: SiTripadvisor, value: score(SOCIAL_PROOF_RATINGS.tripadvisor.score), label: "Tripadvisor", detail: reviews(SOCIAL_PROOF_RATINGS.tripadvisor.reviews) },
    { value: "15+", label: "Anos", detail: HOTEL_EXPERIENCE_LABEL.replace(/^\+?15\s*anos\s*de\s*/i, "de ") },
  ];

  return (
    <section aria-label="Avaliações dos hóspedes" className="bg-[color:var(--brand-forest)] py-8 text-white md:py-10">
      <div className="container">
        <p className={`${styles.eyebrow} text-[color:var(--brand-gold)]`}>{SOCIAL_PROOF_TOTAL_LABEL}</p>
        <ul className="mt-5 grid grid-cols-2 gap-y-6 md:grid-cols-4">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className={`pr-4 ${index > 0 ? "md:border-l md:border-white/15 md:pl-8" : ""} ${index % 2 === 1 ? "max-md:border-l max-md:border-white/15 max-md:pl-6" : ""}`}>
                <p className={`${styles.display} text-[clamp(2.2rem,4vw,3.4rem)] text-[color:var(--brand-gold)]`}>{item.value}</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-white">
                  {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5 text-white/70" /> : null}
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-white/75">{item.detail}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
