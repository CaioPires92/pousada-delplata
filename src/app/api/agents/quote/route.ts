import { NextResponse } from "next/server";

import { queryAvailabilityQuote } from "@/lib/availability/quote-service";
import { isDayKey } from "@/lib/day-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QuotePayload = {
  checkIn?: unknown;
  checkOut?: unknown;
  adults?: unknown;
  childrenAges?: unknown;
  roomType?: unknown;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asPositiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === "number"
    ? value
    : Number.parseInt(String(value ?? ""), 10);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseChildrenAges(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((age) => Number.parseInt(String(age), 10))
      .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((age) => Number.parseInt(age.trim(), 10))
      .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17);
  }

  return [];
}

function getBaseUrl(request: Request) {
  const configuredUrl = process.env.AGENT_QUOTE_PUBLIC_BASE_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configuredUrl) {
    const normalized = configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`;
    return normalized.replace(/\/$/, "");
  }

  return new URL(request.url).origin;
}

function buildBookingUrl(request: Request, params: {
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  roomTypeId: string;
}) {
  const url = new URL("/reservar", getBaseUrl(request));
  url.searchParams.set("checkIn", params.checkIn);
  url.searchParams.set("checkOut", params.checkOut);
  url.searchParams.set("adults", String(params.adults));
  url.searchParams.set("children", String(params.childrenAges.length));
  if (params.childrenAges.length > 0) {
    url.searchParams.set("childrenAges", params.childrenAges.join(","));
  }
  url.searchParams.set("roomTypeId", params.roomTypeId);
  return url.toString();
}

function normalizeRoomTypeFilter(value: unknown) {
  return asTrimmedString(value).toLowerCase();
}

async function readPayload(request: Request): Promise<QuotePayload> {
  if (request.method === "GET") {
    const params = new URL(request.url).searchParams;
    return {
      checkIn: params.get("checkIn"),
      checkOut: params.get("checkOut"),
      adults: params.get("adults"),
      childrenAges: params.get("childrenAges"),
      roomType: params.get("roomType"),
    };
  }

  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function handleQuote(request: Request) {
  try {
    const payload = await readPayload(request);
    const checkIn = asTrimmedString(payload.checkIn);
    const checkOut = asTrimmedString(payload.checkOut);

    if (!isDayKey(checkIn) || !isDayKey(checkOut)) {
      return NextResponse.json({
        ok: false,
        error: "invalid_or_missing_dates",
        message: "Informe checkIn e checkOut no formato YYYY-MM-DD.",
      }, { status: 400 });
    }

    const adults = asPositiveInteger(payload.adults, 2);
    const childrenAges = parseChildrenAges(payload.childrenAges);
    const roomTypeFilter = normalizeRoomTypeFilter(payload.roomType);
    const quote = await queryAvailabilityQuote({
      checkin: checkIn,
      checkout: checkOut,
      adults,
      childrenAges,
      includeRoomDetails: false,
    });

    if (!quote.ok) {
      return NextResponse.json({
        ok: false,
        error: quote.error,
        message: quote.error === "min_stay_required" && quote.minLos
          ? `Estadia minima de ${quote.minLos} noite(s) para as datas selecionadas.`
          : "Nao foi possivel calcular a cotacao com os dados informados.",
        minLos: quote.minLos,
      }, { status: quote.error === "invalid_date_range" || quote.error === "invalid_guest_count" ? 400 : 422 });
    }

    const filteredOptions = roomTypeFilter
      ? quote.options.filter((option) => option.roomTypeName.toLowerCase().includes(roomTypeFilter))
      : quote.options;

    const options = filteredOptions.map((option) => ({
      roomTypeId: option.roomTypeId,
      roomTypeName: option.roomTypeName,
      available: option.remainingUnits > 0,
      remainingUnits: option.remainingUnits,
      maxGuests: option.maxGuests,
      nights: quote.nights,
      minLos: option.minLos,
      totalPrice: option.totalPrice,
      currency: "BRL",
      dailyAverage: Math.round((option.totalPrice / quote.nights) * 100) / 100,
      priceBreakdown: option.priceBreakdown,
      bookingUrl: buildBookingUrl(request, {
        checkIn,
        checkOut,
        adults,
        childrenAges,
        roomTypeId: option.roomTypeId,
      }),
    }));

    return NextResponse.json({
      ok: true,
      checkIn: quote.checkin,
      checkOut: quote.checkout,
      adults,
      children: childrenAges.length,
      childrenAges,
      nights: quote.nights,
      quoteId: quote.quoteId,
      calculatedAt: quote.calculatedAt,
      expiresAt: quote.expiresAt,
      available: options.length > 0,
      options,
      message: options.length > 0
        ? "Cotacao calculada com disponibilidade no motor de reservas."
        : "Nao ha acomodacoes disponiveis para os filtros informados.",
      notes: [
        "Valores e disponibilidade sao consultados no motor de reservas.",
        "A reserva so fica garantida apos finalizar o processo no site ou confirmacao da recepcao.",
      ],
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: "internal_error",
      message: "Erro interno ao consultar cotacao.",
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleQuote(request);
}

export async function POST(request: Request) {
  return handleQuote(request);
}
