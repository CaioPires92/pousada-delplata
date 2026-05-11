import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { queryAvailabilityQuote } from "@/lib/crm/availabilityQuote";
import { recordCrmEvent } from "@/lib/crm/events";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

function asPositiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;

  return parsed;
}

function asNonNegativeInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;

  return parsed;
}

function parseChildrenAges(value: unknown, childrenCount: number) {
  if (Array.isArray(value)) {
    const ages = value
      .map(age => typeof age === "number" ? age : Number.parseInt(String(age ?? ""), 10))
      .filter(age => Number.isInteger(age) && age >= 0 && age <= 17);

    if (ages.length === childrenCount) return ages;
  }

  return Array.from({ length: childrenCount }, () => 0);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!isRecord(body)) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const conversationId = asNonEmptyString(body.conversationId);
    const checkin = asNonEmptyString(body.checkin);
    const checkout = asNonEmptyString(body.checkout);
    const adults = asPositiveInteger(body.adults);
    const children = asNonNegativeInteger(body.children ?? 0);

    if (!conversationId || !checkin || !checkout || !adults || children === undefined) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        contactId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ ok: false, error: "conversation_not_found" }, { status: 404 });
    }

    const childrenAges = parseChildrenAges(body.childrenAges, children);
    const quote = await queryAvailabilityQuote({
      checkin,
      checkout,
      adults,
      childrenAges,
    });

    await recordCrmEvent({
      action: "QuoteRequested",
      contactId: conversation.contactId,
      conversationId: conversation.id,
      metadata: {
        checkin,
        checkout,
        adults,
        children,
        childrenAges,
        resultOk: quote.ok,
        optionsCount: quote.ok ? quote.options.length : 0,
        error: quote.ok ? null : quote.error,
      },
    });

    if (!quote.ok) {
      return NextResponse.json(
        { ok: false, error: quote.error, minLos: quote.minLos },
        { status: quote.error === "min_stay_required" ? 400 : 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversationId: conversation.id,
      quote,
    });
  } catch (error) {
    console.error("Erro ao consultar orçamento CRM:", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
