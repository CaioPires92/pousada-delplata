import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { isPipelineStage, normalizePipelineStage } from "@/lib/crm/pipelineStages";

export type UpdatePipelineCardInput = {
  stage?: unknown;
  reason?: unknown;
  actorType?: "human" | "n8n" | "system";
  estimatedValue?: unknown;
  intendedArrival?: unknown;
  intendedCheckin?: unknown;
  intendedCheckout?: unknown;
  adults?: unknown;
  children?: unknown;
  roomTypeInterest?: unknown;
  lossReason?: unknown;
  lostReason?: unknown;
  bookingId?: unknown;
};

export type UpdatePipelineCardResult =
  | { ok: true; card: Awaited<ReturnType<typeof updatePipelineCardUnchecked>>; stageChanged: boolean }
  | { ok: false; status: number; error: string };

function parseNullableDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed;
}

function parseNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;

  return parsed;
}

function parseNullableInteger(value: unknown): number | null | undefined {
  const parsed = parseNullableNumber(value);
  if (parsed === undefined || parsed === null) return parsed;
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;

  return parsed;
}

function parseNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || null;
}

async function updatePipelineCardUnchecked(
  id: string,
  data: Prisma.PipelineCardUpdateInput
) {
  return prisma.pipelineCard.update({
    where: { id },
    data,
    include: {
      contact: {
        select: {
          id: true,
        },
      },
      conversation: {
        select: {
          id: true,
        },
      },
    },
  });
}

export async function updatePipelineCard(
  id: string,
  input: UpdatePipelineCardInput
): Promise<UpdatePipelineCardResult> {
  const existing = await prisma.pipelineCard.findUnique({
    where: { id },
    select: {
      id: true,
      stage: true,
      contactId: true,
      conversationId: true,
      intendedCheckin: true,
      intendedCheckout: true,
    },
  });

  if (!existing) {
    return { ok: false, status: 404, error: "card_not_found" };
  }

  const updateData: Prisma.PipelineCardUpdateInput = {
    lastActivityAt: new Date(),
  };
  const changedFields: string[] = [];

  let nextStage: string | undefined;

  if (input.stage !== undefined) {
    if (typeof input.stage !== "string" || !isPipelineStage(input.stage)) {
      return { ok: false, status: 400, error: "invalid_stage" };
    }

    nextStage = normalizePipelineStage(input.stage);
    updateData.stage = nextStage;
  }

  const estimatedValue = parseNullableNumber(input.estimatedValue);
  if (input.estimatedValue !== undefined) {
    if (estimatedValue === undefined) return { ok: false, status: 400, error: "invalid_estimated_value" };
    updateData.estimatedValue = estimatedValue;
    changedFields.push("estimatedValue");
  }

  const intendedArrival = parseNullableDate(input.intendedArrival);
  if (input.intendedArrival !== undefined) {
    if (intendedArrival === undefined) return { ok: false, status: 400, error: "invalid_intended_arrival" };
    updateData.intendedArrival = intendedArrival;
    changedFields.push("intendedArrival");
  }

  const intendedCheckin = parseNullableDate(input.intendedCheckin);
  if (input.intendedCheckin !== undefined) {
    if (intendedCheckin === undefined) return { ok: false, status: 400, error: "invalid_intended_checkin" };
    updateData.intendedCheckin = intendedCheckin;
    updateData.intendedArrival = intendedCheckin;
    changedFields.push("intendedCheckin", "intendedArrival");
  }

  const intendedCheckout = parseNullableDate(input.intendedCheckout);
  if (input.intendedCheckout !== undefined) {
    if (intendedCheckout === undefined) return { ok: false, status: 400, error: "invalid_intended_checkout" };
    updateData.intendedCheckout = intendedCheckout;
    changedFields.push("intendedCheckout");
  }

  const effectiveCheckin = input.intendedCheckin !== undefined ? intendedCheckin : existing.intendedCheckin;
  const effectiveCheckout = input.intendedCheckout !== undefined ? intendedCheckout : existing.intendedCheckout;

  if (effectiveCheckin instanceof Date && effectiveCheckout instanceof Date && effectiveCheckout <= effectiveCheckin) {
    return { ok: false, status: 400, error: "invalid_date_range" };
  }

  const adults = parseNullableInteger(input.adults);
  if (input.adults !== undefined) {
    if (adults === undefined || adults === 0) return { ok: false, status: 400, error: "invalid_adults" };
    updateData.adults = adults;
    changedFields.push("adults");
  }

  const children = parseNullableInteger(input.children);
  if (input.children !== undefined) {
    if (children === undefined) return { ok: false, status: 400, error: "invalid_children" };
    updateData.children = children;
    changedFields.push("children");
  }

  const roomTypeInterest = parseNullableString(input.roomTypeInterest);
  if (input.roomTypeInterest !== undefined) {
    if (roomTypeInterest === undefined) return { ok: false, status: 400, error: "invalid_room_type_interest" };
    updateData.roomTypeInterest = roomTypeInterest;
    changedFields.push("roomTypeInterest");
  }

  const lossReason = parseNullableString(input.lossReason);
  if (input.lossReason !== undefined) {
    if (lossReason === undefined) return { ok: false, status: 400, error: "invalid_loss_reason" };
    updateData.lossReason = lossReason;
    updateData.lostReason = lossReason;
    changedFields.push("lossReason", "lostReason");
  }

  const lostReason = parseNullableString(input.lostReason);
  if (input.lostReason !== undefined) {
    if (lostReason === undefined) return { ok: false, status: 400, error: "invalid_lost_reason" };
    updateData.lostReason = lostReason;
    updateData.lossReason = lostReason;
    changedFields.push("lostReason", "lossReason");
  }

  const bookingId = parseNullableString(input.bookingId);
  if (input.bookingId !== undefined) {
    if (bookingId === undefined) return { ok: false, status: 400, error: "invalid_booking_id" };
    updateData.bookingId = bookingId;
    changedFields.push("bookingId");
  }

  const card = await updatePipelineCardUnchecked(id, updateData);
  const normalizedPreviousStage = normalizePipelineStage(existing.stage);
  const stageChanged = Boolean(nextStage && nextStage !== normalizedPreviousStage);

  if (stageChanged) {
    const reason = parseNullableString(input.reason);

    await recordCrmEvent({
      action: "PipelineStageChanged",
      contactId: existing.contactId,
      conversationId: existing.conversationId ?? undefined,
      metadata: {
        pipelineCardId: existing.id,
        fromStage: normalizedPreviousStage,
        toStage: nextStage,
        reason: reason ?? null,
        actorType: input.actorType ?? "human",
      },
    });
  }

  if (changedFields.length > 0) {
    await recordCrmEvent({
      action: "PipelineCardCommercialFieldsUpdated",
      contactId: existing.contactId,
      conversationId: existing.conversationId ?? undefined,
      metadata: {
        pipelineCardId: existing.id,
        changedFields: Array.from(new Set(changedFields)),
        actorType: input.actorType ?? "human",
      },
    });
  }

  return { ok: true, card, stageChanged };
}
