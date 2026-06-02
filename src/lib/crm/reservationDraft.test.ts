import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { upsertReservationDraftFromMessage } from "./reservationDraft";

vi.mock("@/lib/prisma", () => ({
  default: {
    reservationDraft: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("upsertReservationDraftFromMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates draft when none exists", async () => {
    vi.mocked(prisma.reservationDraft.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.reservationDraft.create).mockResolvedValue({ id: "draft-1" } as any);

    await upsertReservationDraftFromMessage({
      contactId: "contact-1",
      conversationId: "conv-1",
      pipelineCardId: "card-1",
      text: "sou Joao, meu email joao@example.com e prefiro pix",
    });

    expect(prisma.reservationDraft.create).toHaveBeenCalled();
  });

  it("updates existing draft without overwriting filled fields", async () => {
    vi.mocked(prisma.reservationDraft.findFirst).mockResolvedValue({
      id: "draft-1",
      guestName: "Joao",
      guestCpf: null,
      guestEmail: null,
      paymentMethod: null,
    } as any);
    vi.mocked(prisma.reservationDraft.update).mockResolvedValue({ id: "draft-1" } as any);

    await upsertReservationDraftFromMessage({
      contactId: "contact-1",
      conversationId: "conv-1",
      text: "meu cpf 123.456.789-10 e email joao@example.com",
    });

    expect(prisma.reservationDraft.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "draft-1" },
      data: expect.objectContaining({
        guestName: "Joao",
        guestCpf: "12345678910",
      }),
    }));
  });
});
