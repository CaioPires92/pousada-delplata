import { History } from "lucide-react";
import { SiBookingdotcom, SiGoogle, SiTripadvisor } from "react-icons/si";
import EditorialStats, { type EditorialStatItem } from "@/components/system/EditorialStats";
import {
  HOTEL_EXPERIENCE_LABEL,
  SOCIAL_PROOF_RATINGS,
  SOCIAL_PROOF_TOTAL_LABEL,
} from "@/constants/socialProof";

interface SocialProofBadgesProps {
  className?: string;
  showTotal?: boolean;
  variant?: "hero" | "light";
}

function formatScore(score: number) {
  return score.toFixed(1).replace(".", ",");
}

function formatReviews(reviews: number) {
  return new Intl.NumberFormat("pt-BR").format(reviews);
}

export default function SocialProofBadges({ className = "", showTotal = true, variant = "hero" }: SocialProofBadgesProps) {
  const isLight = variant === "light";
  const lightItems: EditorialStatItem[] = [
    {
      icon: SiGoogle,
      label: "Google",
      value: formatScore(SOCIAL_PROOF_RATINGS.google.score),
      description: `${formatReviews(SOCIAL_PROOF_RATINGS.google.reviews)} avaliações`,
    },
    {
      icon: SiBookingdotcom,
      label: "Booking",
      value: formatScore(SOCIAL_PROOF_RATINGS.booking.score),
      description: `${formatReviews(SOCIAL_PROOF_RATINGS.booking.reviews)} avaliações`,
    },
    {
      icon: SiTripadvisor,
      label: "Tripadvisor",
      value: formatScore(SOCIAL_PROOF_RATINGS.tripadvisor.score),
      description: `${formatReviews(SOCIAL_PROOF_RATINGS.tripadvisor.reviews)} avaliações`,
    },
    {
      icon: History,
      label: "História",
      noWrapDescription: true,
      value: "15+ anos",
      description: HOTEL_EXPERIENCE_LABEL,
    },
  ];

  if (isLight) {
    return (
      <EditorialStats
        className={className}
        items={lightItems}
        footer={showTotal ? SOCIAL_PROOF_TOTAL_LABEL : undefined}
      />
    );
  }

  return (
    <div className={`w-full max-w-3xl mx-auto ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#d6c089] drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]">
        <div className="inline-flex items-center gap-2">
          <SiGoogle className="h-4 w-4 text-amber-300" role="img" aria-label="Avaliação no Google" />
          <span className="font-semibold">{formatScore(SOCIAL_PROOF_RATINGS.google.score)}</span>
          <span className="text-[#e6d9bc]">Google</span>
        </div>
        <span className="hidden h-3.5 w-px bg-[#d6c089]/30 sm:block" />
        <div className="inline-flex items-center gap-2">
          <SiBookingdotcom className="h-4 w-4 text-sky-200" role="img" aria-label="Avaliação no Booking" />
          <span className="font-semibold">{formatScore(SOCIAL_PROOF_RATINGS.booking.score)}</span>
          <span className="text-[#e6d9bc]">Booking</span>
        </div>
      </div>
      {showTotal ? (
        <p className="mt-2 text-xs font-normal text-[#e6d9bc] drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]">{SOCIAL_PROOF_TOTAL_LABEL}</p>
      ) : null}
    </div>
  );
}
