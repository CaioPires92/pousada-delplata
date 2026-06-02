import prisma from "@/lib/prisma";

export const runtime = "nodejs";

function encoderLine(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const url = new URL(request.url);
  const intervalMs = Math.max(1000, Math.min(10000, Number.parseInt(url.searchParams.get("intervalMs") ?? "3000", 10) || 3000));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const tick = async () => {
        if (closed) return;

        try {
          const conversation = await prisma.conversation.findUnique({
            where: { id },
            select: {
              id: true,
              updatedAt: true,
              lastMessageAt: true,
              messages: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  senderType: true,
                  content: true,
                  messageType: true,
                  mediaUrl: true,
                  createdAt: true,
                  sentAt: true,
                },
              },
            },
          });

          controller.enqueue(encoder.encode(encoderLine({
            ok: true,
            conversationId: id,
            updatedAt: conversation?.updatedAt ?? null,
            lastMessageAt: conversation?.lastMessageAt ?? null,
            messages: conversation?.messages ?? [],
          })));
        } catch (error) {
          controller.enqueue(encoder.encode(encoderLine({ ok: false, error: "stream_error", detail: error instanceof Error ? error.message : "unknown" })));
        }
      };

      await tick();
      const intervalId = setInterval(tick, intervalMs);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
