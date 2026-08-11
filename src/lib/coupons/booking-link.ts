import { normalizeCouponCode } from "@/lib/coupons/hash";
import { createHmac, timingSafeEqual } from "crypto";

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

function clickToken(grantId: string) {
  const secret = String(process.env.ADMIN_JWT_SECRET || "");
  if (!secret) throw new Error("ADMIN_JWT_SECRET is required to protect coupon links");
  return createHmac("sha256", secret).update(`coupon-click:${grantId}`).digest("base64url");
}

export function buildTrackedCouponUrl(grantId: string, baseUrl = configuredSiteUrl()) {
  const siteUrl = new URL(baseUrl, OFFICIAL_SITE_URL);
  const trackingUrl = new URL(`/api/coupons/grants/${encodeURIComponent(grantId)}/click`, siteUrl);
  trackingUrl.searchParams.set("token", clickToken(grantId));
  return trackingUrl.toString();
}

export function verifyCouponClickToken(grantId: string, token: string) {
  const expected = Buffer.from(clickToken(grantId));
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
