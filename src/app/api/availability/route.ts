import { NextResponse } from "next/server";

import { queryAvailabilityQuote } from "@/lib/availability/quote-service";
import { normalizeCouponCode } from "@/lib/coupons/hash";
import { validateCoupon } from "@/lib/coupons/validate";
import { getDiscountPolicy } from "@/lib/discount-policy-store";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");

    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: "Check-in e check-out são obrigatórios" }, { status: 400 });
    }

    const adults = Number.parseInt(searchParams.get("adults") || "2", 10);
    const childrenAges = searchParams.get("childrenAges")?.split(",").map(Number) || [];
    const promoCode = normalizeCouponCode(searchParams.get("promo") || searchParams.get("coupon") || "");
    const quote = await queryAvailabilityQuote({
      checkin: checkIn,
      checkout: checkOut,
      adults,
      childrenAges,
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
      let discountAmount = 0;
      let priceDiscounted: number | undefined;
      let roomPromoApplied = false;
      let roomPromoMessage: string | undefined;

      if (promoCode) {
        const couponResult = await validateCoupon({
          code: promoCode,
          subtotal: option.totalPrice,
          roomTypeId: option.roomTypeId,
          source: "direct",
          checkIn,
          checkOut,
          blockedDateRanges: discountPolicy?.blockedDateRanges,
          preview: true,
        });

        if (couponResult.valid) {
          discountAmount = Number(couponResult.discountAmount || 0);
          priceDiscounted = Number(couponResult.total || option.totalPrice);
          roomPromoApplied = priceDiscounted < option.totalPrice;
          roomPromoMessage = getPromoMessage(couponResult.reason || "OK");
          if (roomPromoApplied) promoApplied = true;
        } else {
          roomPromoMessage = getPromoMessage(couponResult.reason || "INVALID_CODE");
          if (!promoMessage) promoMessage = roomPromoMessage;
        }
      }

      return {
        ...option.roomDetails,
        totalPrice: roomPromoApplied && Number.isFinite(priceDiscounted)
          ? Number(priceDiscounted)
          : option.totalPrice,
        priceOriginal: option.totalPrice,
        priceDiscounted: roomPromoApplied ? Number(priceDiscounted) : undefined,
        discountAmount: roomPromoApplied ? discountAmount : 0,
        promoApplied: roomPromoApplied,
        promoMessage: roomPromoMessage,
        promoCodeNormalized: promoCode || undefined,
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
