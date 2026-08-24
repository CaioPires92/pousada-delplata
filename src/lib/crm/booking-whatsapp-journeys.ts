import prisma from "@/lib/prisma";
import { enqueueAutomationJob } from "@/lib/crm/automationQueue";
import {
  buildBookingConfirmationWhatsAppMessage,
  buildBookingRecoveryWhatsAppMessage,
  normalizeWhatsAppPhone,
} from "@/lib/booking-whatsapp";

type BookingJourneyStatus = "PENDING" | "EXPIRED" | "CONFIRMED";
type BookingJourneyType =
  | "booking_pending"
  | "booking_expired"
  | "booking_confirmed";

const BOOKING_WHATSAPP_MAX_STALENESS_HOURS: Record<BookingJourneyStatus, number> = {
  PENDING: 24,
  EXPIRED: 24,
  CONFIRMED: 48,
};

async function getOptedInConversation(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      crmConversationId: true,
      crmContactId: true,
      guest: { select: { name: true, phone: true } },
      roomType: { select: { name: true } },
      checkIn: true,
      checkOut: true,
      crmConversation: {
        select: {
          contact: {
            select: {
              optInWhatsapp: true,
              optOutAt: true,
            },
          },
        },
      },
    },
  });

  if (!booking?.crmConversationId || !booking.crmConversation?.contact) return null;
  if (!booking.crmConversation.contact.optInWhatsapp || booking.crmConversation.contact.optOutAt) return null;
  return booking;
}

export async function enqueueBookingWhatsAppJourney(input: {
  bookingId: string;
  status: BookingJourneyStatus;
}) {
  const booking = await getOptedInConversation(input.bookingId);
  if (!booking) {
    return { scheduled: false as const, reason: "whatsapp_consent_missing" as const };
  }

  const phone = booking.guest.phone ? normalizeWhatsAppPhone(booking.guest.phone) : "";
  if (!phone) {
    return { scheduled: false as const, reason: "missing_phone" as const };
  }
  const conversationId = booking.crmConversationId;
  if (!conversationId) {
    return { scheduled: false as const, reason: "missing_conversation" as const };
  }

  const text = input.status === "CONFIRMED"
    ? buildBookingConfirmationWhatsAppMessage({
        bookingId: input.bookingId,
        guestName: booking.guest.name,
        roomName: booking.roomType.name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      })
    : buildBookingRecoveryWhatsAppMessage({
        bookingId: input.bookingId,
        guestName: booking.guest.name,
        roomName: booking.roomType.name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        stage: input.status,
      });

  const journeyTypeByStatus: Record<BookingJourneyStatus, BookingJourneyType> = {
    PENDING: "booking_pending",
    EXPIRED: "booking_expired",
    CONFIRMED: "booking_confirmed",
  };

  const job = await enqueueAutomationJob({
    conversationId,
    action: "SEND_WHATSAPP_MESSAGE",
    journeyType: journeyTypeByStatus[input.status],
    dedupeKey: `booking:${input.bookingId}:${input.status.toLowerCase()}:whatsapp`,
    payload: {
      target: phone,
      text,
      bookingId: input.bookingId,
      maxStalenessHours: BOOKING_WHATSAPP_MAX_STALENESS_HOURS[input.status],
    },
  });

  return { scheduled: true as const, jobId: job.id };
}
