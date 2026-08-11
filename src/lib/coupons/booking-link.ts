import { normalizeCouponCode } from "@/lib/coupons/hash";

const OFFICIAL_SITE_URL = "https://www.pousadadelplata.com.br";

function configuredSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_BASE_URL
    || process.env.APP_URL
    || OFFICIAL_SITE_URL;
}

export function buildPreappliedCouponUrl(code: string, baseUrl = configuredSiteUrl()) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) throw new Error("coupon_code_required");

  let siteUrl: URL;
  try {
    siteUrl = new URL(baseUrl);
  } catch {
    siteUrl = new URL(OFFICIAL_SITE_URL);
  }
  if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") siteUrl = new URL(OFFICIAL_SITE_URL);

  const bookingUrl = new URL("/reservar", siteUrl);
  bookingUrl.searchParams.set("promo", normalizedCode);
  return bookingUrl.toString();
}
