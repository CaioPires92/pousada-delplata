import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Pegamos os últimos 10 eventos relevantes para notificação
    const logs = await prisma.internalActionLog.findMany({
      where: {
        action: {
          in: ["LeadCreated", "MessageReceived"]
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10,
      include: {
        contact: {
          select: {
            name: true
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      notifications: logs.map(log => ({
        id: log.id,
        action: log.action,
        contactName: log.contact?.name || "Desconhecido",
        createdAt: log.createdAt,
        metadata: log.metadataJson ? JSON.parse(log.metadataJson) : {}
      }))
    });
  } catch (error) {
    console.error("Erro ao buscar notificações do CRM:", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
