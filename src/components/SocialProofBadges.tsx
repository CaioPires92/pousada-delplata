import { Award, Star } from "lucide-react";
import { SOCIAL_PROOF_RATINGS, SOCIAL_PROOF_TOTAL_LABEL } from "@/constants/socialProof";

interface SocialProofBadgesProps {
  className?: string;
  showTotal?: boolean;
}

function formatScore(score: number) {
  return score.toFixed(1).replace(".", ",");
}

function formatReviews(reviews: number) {
  return new Intl.NumberFormat("pt-BR").format(reviews);
}

export default function SocialProofBadges({ className = "", showTotal = true }: SocialProofBadgesProps) {
  return (
    <div className={`w-full max-w-3xl mx-auto ${className}`.trim()}>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
        <div className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-black/40 px-3.5 py-1.5 text-sm text-white shadow-sm backdrop-blur-sm">
          <Star className="h-4 w-4 text-amber-300" role="img" aria-label="Avaliação no Google" />
          <span className="font-semibold">{formatScore(SOCIAL_PROOF_RATINGS.google.score)} no Google</span>
          <span className="text-white/80">({formatReviews(SOCIAL_PROOF_RATINGS.google.reviews)} avaliações)</span>
        </div>
        <div className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-black/40 px-3.5 py-1.5 text-sm text-white shadow-sm backdrop-blur-sm">
          <Award className="h-4 w-4 text-sky-200" role="img" aria-label="Avaliação no Booking" />
          <span className="font-semibold">{formatScore(SOCIAL_PROOF_RATINGS.booking.score)} no Booking</span>
          <span className="text-white/80">({formatReviews(SOCIAL_PROOF_RATINGS.booking.reviews)} avaliações)</span>
        </div>
      </div>
      {showTotal ? (
        <p className="mt-1.5 text-xs font-normal text-white/70 text-center">{SOCIAL_PROOF_TOTAL_LABEL}</p>
      ) : null}
    </div>
  );
}
