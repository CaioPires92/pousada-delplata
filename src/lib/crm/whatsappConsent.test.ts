import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: { $transaction: vi.fn() } }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { isWhatsappOptOutMessage, setWhatsappConsent } from "@/lib/crm/whatsappConsent";

describe("WhatsApp consent", () => {
  const tx = {
    contact: { update: vi.fn() },
    automationQueueJob: { updateMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async callback => callback(tx as never));
    tx.contact.update.mockResolvedValue({
      id: "contact-1",
      optInWhatsapp: false,
      optOutAt: new Date("2026-08-10T18:00:00.000Z"),
    });
    tx.automationQueueJob.updateMany.mockResolvedValue({ count: 3 });
    vi.mocked(recordCrmEvent).mockResolvedValue(null);
  });

  it("recognizes only explicit standalone opt-out commands", () => {
    expect(isWhatsappOptOutMessage("SAIR")).toBe(true);
    expect(isWhatsappOptOutMessage(" parar! ")).toBe(true);
    expect(isWhatsappOptOutMessage("Quero cancelar minha reserva")).toBe(false);
  });

  it("revokes consent and cancels every pending WhatsApp job", async () => {
    await expect(setWhatsappConsent({
      contactId: "contact-1",
      optInWhatsapp: false,
      origin: "webhook",
    })).resolves.toMatchObject({ cancelledJobs: 3 });

    expect(tx.automationQueueJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        action: "SEND_WHATSAPP_MESSAGE",
        status: "pending",
        conversation: { contactId: "contact-1" },
      }),
      data: expect.objectContaining({ cancelReason: "contact_opted_out" }),
    }));
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "ContactConsentUpdated",
      metadata: expect.objectContaining({ cancelledJobs: 3, reason: "Opt-out solicitado" }),
    }));
  });
});
