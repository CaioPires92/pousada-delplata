import { NextResponse } from "next/server";
import { isMobileRequest } from "@/lib/device";

import { queryAvailabilityQuote } from "@/lib/availability/quote-service";
import { normalizeCouponCode } from "@/lib/coupons/hash";
import { validateCoupon } from "@/lib/coupons/validate";
import { getDiscountPolicy } from "@/lib/discount-policy-store";
import { toPublicPromotion } from "@/lib/promotions/engine";
import { resolveStayPricing, type CouponBlockedReason } from "@/lib/promotions/stacking";

export const dynamic = "force-dynamic";

function getPromoMessage(reason: string) {
  if (reason === "OK") return "Cupom aplicado.";
  if (reason === "EXPIRED") return "Cupom expirado.";
  if (reason === "NOT_STARTED") return "Cupom ainda não está ativo.";
  if (reason === "MIN_BOOKING_NOT_REACHED") return "Cupom indisponível para o valor atual da reserva.";
  if (reason === "STAY_DATE_BLOCKED") return "Cupom indisponível para as datas selecionadas.";
  if (reason === "ROOM_NOT_ELIGIBLE") return "Cupom não aplicável para este quarto.";
  if (reason === "SOURCE_NOT_ELIGIBLE") return "Cupom não disponível para este canal.";
  if (reason === "USAGE_LIMIT_REACHED" || reason === "GUEST_USAGE_LIMIT_REACHED") {
    return "Limite de uso do cupom atingido.";
  }
  if (reason === "INACTIVE") return "Cupom inativo.";
  if (reason === "INVALID_CODE") return "Cupom inválido.";
  return "Cupom indisponível no momento.";
}

function getCouponBlockedMessage(reason: CouponBlockedReason) {
  if (reason === "PROMOTION_EXCLUSIVE") return "Esta oferta não acumula com cupons.";
  return "A oferta atual já tem o melhor preço; o cupom não acumula com ela.";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");

    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: "Check-in e check-out são obrigatórios" }, { status: 400 });
    }

    const adults = Number.parseInt(searchParams.get("adults") || "2", 10);
    const pets = Math.max(0, Number.parseInt(searchParams.get("pets") || "0", 10) || 0);
    const childrenAges = searchParams.get("childrenAges")?.split(",").map(Number) || [];
    const promoCode = normalizeCouponCode(searchParams.get("promo") || searchParams.get("coupon") || "");
    const quote = await queryAvailabilityQuote({
      checkin: checkIn,
      checkout: checkOut,
      adults,
      childrenAges,
      pets,
      isMobile: isMobileRequest(request),
      includeRoomDetails: true,
    });

    if (!quote.ok) {
      const status = quote.error === "invalid_date_range" || quote.error === "min_stay_required" ? 400 : 422;
      return NextResponse.json(
        {
          error: quote.error,
          ...(quote.minLos === undefined ? {} : { minLos: quote.minLos }),
        },
        { status }
      );
    }

    let promoApplied = false;
    let promoMessage: string | undefined;
    const discountPolicy = promoCode ? await getDiscountPolicy() : null;
    const rooms = await Promise.all(quote.options.map(async option => {
      // Promoção automática + cupom: regra única de compatibilidade (ver promotions/stacking).
      const pricing = await resolveStayPricing({
        fullTotal: option.totalPrice,
        promotion: option.promotion,
        evaluateCoupon: promoCode
          ? async subtotal => {
              const couponResult = await validateCoupon({
                code: promoCode,
                subtotal,
                roomTypeId: option.roomTypeId,
                source: "direct",
                checkIn,
                checkOut,
                blockedDateRanges: discountPolicy?.blockedDateRanges,
                preview: true,
              });
              return {
                valid: couponResult.valid,
                reason: couponResult.reason,
                couponId: couponResult.couponId,
                stackable: couponResult.stackable,
                discountAmount: couponResult.discountAmount,
                total: couponResult.total,
              };
            }
          : null,
      });

      const roomPromoApplied = pricing.couponApplied && pricing.couponDiscount > 0;
      let roomPromoMessage: string | undefined;

      if (promoCode) {
        if (roomPromoApplied) {
          roomPromoMessage = getPromoMessage("OK");
          promoApplied = true;
        } else if (pricing.couponBlockedReason) {
          roomPromoMessage = getCouponBlockedMessage(pricing.couponBlockedReason);
        } else {
          roomPromoMessage = getPromoMessage(pricing.coupon?.reason || "INVALID_CODE");
        }
        if (!roomPromoApplied && !promoMessage) promoMessage = roomPromoMessage;
      }

      const publicPromotion = pricing.promotion ? toPublicPromotion(pricing.promotion) : null;

      return {
        ...option.roomDetails,
        // totalPrice = preço final (promoção + cupom já aplicados).
        totalPrice: pricing.finalTotal,
        // priceOriginal = base do cupom (preço após a promoção). O front usa como subtotal do cupom.
        priceOriginal: pricing.subtotalAfterPromotion,
        // priceFull = preço cheio, sem nenhum desconto (preço "riscado" da promoção).
        priceFull: pricing.fullTotal,
        priceDiscounted: roomPromoApplied ? pricing.finalTotal : undefined,
        discountAmount: roomPromoApplied ? pricing.couponDiscount : 0,
        promoApplied: roomPromoApplied,
        promoMessage: roomPromoMessage,
        promoCodeNormalized: promoCode || undefined,
        couponBlockedReason: pricing.couponBlockedReason,
        promotion: publicPromotion
          ? {
              id: publicPromotion.id,
              name: publicPromotion.name,
              type: publicPromotion.type,
              badgeLabel: publicPromotion.badgeLabel,
              discountPercent: publicPromotion.discountPercent,
              discountAmount: pricing.promotionDiscount,
              exclusive: publicPromotion.exclusive,
              stackWithCoupons: publicPromotion.stackWithCoupons,
              items: publicPromotion.items,
            }
          : null,
        priceBreakdown: option.priceBreakdown,
        isAvailable: true,
        remainingUnits: option.remainingUnits,
        minLos: option.minLos,
      };
    }));

    const response = NextResponse.json(rooms);
    response.headers.set("x-quote-id", quote.quoteId);
    response.headers.set("x-quote-version", String(quote.quoteVersion));
    response.headers.set("x-quote-calculated-at", quote.calculatedAt);
    response.headers.set("x-quote-expires-at", quote.expiresAt);
    response.headers.set("x-quote-hash", quote.quoteHash);
    if (promoCode) {
      response.headers.set("x-promo-code", promoCode);
      response.headers.set("x-promo-applied", promoApplied ? "true" : "false");
      if (!promoMessage && !promoApplied) promoMessage = "Cupom inválido ou indisponível.";
      if (promoMessage) response.headers.set("x-promo-message", promoMessage);
    }

    return response;
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
