import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import prisma from "@/lib/prisma";
import { linkBookingToCrm, reconcileBookingToCrm } from "@/lib/crm/bookingCrmLink";

const createdBookingIds: string[] = [];
const createdGuestIds: string[] = [];
const createdRoomTypeIds: string[] = [];
const createdContactIds: string[] = [];

afterEach(async () => {
  if (createdBookingIds.length > 0) {
    await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds.splice(0) } } });
  }
  if (createdContactIds.length > 0) {
    await prisma.contact.deleteMany({ where: { id: { in: createdContactIds.splice(0) } } });
  }
  if (createdGuestIds.length > 0) {
    await prisma.guest.deleteMany({ where: { id: { in: createdGuestIds.splice(0) } } });
  }
  if (createdRoomTypeIds.length > 0) {
    await prisma.roomType.deleteMany({ where: { id: { in: createdRoomTypeIds.splice(0) } } });
  }
});

async function createBookingContext(input?: { phone?: string; email?: string }) {
  const suffix = randomUUID();
  const contact = await prisma.contact.create({
    data: {
      name: "Contato sintético",
      phone: input?.phone ?? `5511${suffix.replace(/\D/g, "").slice(0, 9).padEnd(9, "7")}`,
      email: input?.email ?? `${suffix}@example.test`,
      source: "test",
    },
  });
  createdContactIds.push(contact.id);

  const conversation = await prisma.conversation.create({
    data: { contactId: contact.id, channel: "whatsapp", status: "open" },
  });
  const card = await prisma.pipelineCard.create({
    data: {
      contactId: contact.id,
      conversationId: conversation.id,
      source: "test",
      lastActivityAt: new Date(),
    },
  });

  const guest = await prisma.guest.create({
    data: {
      name: "Hóspede sintético",
      email: input?.email ?? `${suffix}@example.test`,
      phone: input?.phone ?? contact.phone!,
    },
  });
  createdGuestIds.push(guest.id);

  const roomType = await prisma.roomType.create({
    data: {
      name: `Categoria sintética ${suffix}`,
      description: "Somente teste",
      capacity: 2,
      maxGuests: 2,
      totalUnits: 1,
      basePrice: 100,
      amenities: "[]",
    },
  });
  createdRoomTypeIds.push(roomType.id);

  const booking = await prisma.booking.create({
    data: {
      guestId: guest.id,
      roomTypeId: roomType.id,
      checkIn: new Date("2026-09-12T12:00:00.000Z"),
      checkOut: new Date("2026-09-13T12:00:00.000Z"),
      totalPrice: 100,
      status: "PENDING",
    },
  });
  createdBookingIds.push(booking.id);

  return { booking, contact, conversation, card, guest };
}

describe("Booking ↔ CRM linkage", () => {
  it("links booking, contact, conversation and card atomically and idempotently", async () => {
    const context = await createBookingContext();
    const input = {
      bookingId: context.booking.id,
      contactId: context.contact.id,
      conversationId: context.conversation.id,
      pipelineCardId: context.card.id,
    };

    await expect(linkBookingToCrm(input)).resolves.toMatchObject({ ok: true, linked: true });
    await expect(linkBookingToCrm(input)).resolves.toMatchObject({ ok: true, linked: false });

    await expect(prisma.booking.findUnique({ where: { id: context.booking.id } }))
      .resolves.toMatchObject({
        crmContactId: context.contact.id,
        crmConversationId: context.conversation.id,
      });
    await expect(prisma.pipelineCard.findUnique({ where: { id: context.card.id } }))
      .resolves.toMatchObject({ bookingId: context.booking.id });
  });

  it("refuses a conversation that belongs to another contact", async () => {
    const first = await createBookingContext();
    const second = await createBookingContext();

    await expect(linkBookingToCrm({
      bookingId: first.booking.id,
      contactId: first.contact.id,
      conversationId: second.conversation.id,
      pipelineCardId: first.card.id,
    })).resolves.toEqual({ ok: false, reason: "conversation_contact_mismatch" });

    await expect(prisma.booking.findUnique({ where: { id: first.booking.id } }))
      .resolves.toMatchObject({ crmContactId: null, crmConversationId: null });
  });

  it("reconciles a new booking with the active WhatsApp opportunity by phone", async () => {
    const context = await createBookingContext({
      phone: "5519998701203",
      email: "teste.crm@example.test",
    });

    await expect(reconcileBookingToCrm({
      bookingId: context.booking.id,
      guestPhone: "+55 (19) 99870-1203",
      guestEmail: context.guest.email,
    })).resolves.toMatchObject({
      ok: true,
      linked: true,
      contactId: context.contact.id,
      pipelineCardId: context.card.id,
    });
  });
});
