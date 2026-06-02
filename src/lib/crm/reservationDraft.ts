import prisma from "@/lib/prisma";

function extractEmail(text: string): string | undefined {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match?.[0]?.toLowerCase();
}

function extractCpf(text: string): string | undefined {
  const match = text.match(/\b\d{3}[.]?\d{3}[.]?\d{3}[-]?\d{2}\b/);
  if (!match) return undefined;
  return match[0].replace(/\D/g, "");
}

function extractPaymentMethod(text: string): string | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes("pix")) return "pix";
  if (normalized.includes("cart") || normalized.includes("credito") || normalized.includes("débito") || normalized.includes("debito")) return "cartao";
  if (normalized.includes("dinheiro")) return "dinheiro";
  if (normalized.includes("transfer")) return "transferencia";
  return undefined;
}

function extractName(text: string): string | undefined {
  const match = text.match(/(?:meu nome [ée]\s*|sou\s+)([A-Za-zÀ-ÿ\s]{3,60})/i);
  return match?.[1]?.trim();
}

export async function upsertReservationDraftFromMessage(input: {
  contactId: string;
  conversationId: string;
  pipelineCardId?: string;
  text: string;
}) {
  const email = extractEmail(input.text);
  const cpf = extractCpf(input.text);
  const paymentMethod = extractPaymentMethod(input.text);
  const guestName = extractName(input.text);

  const existing = await prisma.reservationDraft.findFirst({
    where: {
      conversationId: input.conversationId,
      status: "in_progress",
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, guestName: true, guestCpf: true, guestEmail: true, paymentMethod: true },
  });

  if (existing) {
    return prisma.reservationDraft.update({
      where: { id: existing.id },
      data: {
        guestName: existing.guestName ?? guestName,
        guestCpf: existing.guestCpf ?? cpf,
        guestEmail: existing.guestEmail ?? email,
        paymentMethod: existing.paymentMethod ?? paymentMethod,
      },
    });
  }

  return prisma.reservationDraft.create({
    data: {
      contactId: input.contactId,
      conversationId: input.conversationId,
      pipelineCardId: input.pipelineCardId,
      guestName,
      guestCpf: cpf,
      guestEmail: email,
      paymentMethod,
      status: "in_progress",
    },
  });
}
