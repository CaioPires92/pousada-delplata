export const SOCIAL_PROOF_RATINGS = {
  google: {
    score: 4.5,
    reviews: 546,
  },
  booking: {
    score: 8.6,
    reviews: 1378,
  },
} as const;

const TOTAL_REVIEWS_ROUNDED_TO_HUNDREDS =
  Math.floor((SOCIAL_PROOF_RATINGS.google.reviews + SOCIAL_PROOF_RATINGS.booking.reviews) / 100) * 100;

export const SOCIAL_PROOF_TOTAL_LABEL = `+${new Intl.NumberFormat("pt-BR").format(TOTAL_REVIEWS_ROUNDED_TO_HUNDREDS)} avaliações reais`;
export const BEST_RATE_GUARANTEE_LABEL = "Melhor tarifa garantida no site oficial";
