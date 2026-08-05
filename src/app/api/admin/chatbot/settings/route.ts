import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { getChatbotRuntimeSettings } from "@/lib/crm/chatbotSettings";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      settings: await getChatbotRuntimeSettings(),
    });
  } catch (error) {
    console.error("Erro ao carregar interruptor global do chatbot", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const changesChatbot = body && typeof body.enabled === "boolean";
    const changesPipeline = body && typeof body.pipelineAutomationEnabled === "boolean";
    if (!changesChatbot && !changesPipeline) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const existing = await prisma.chatbotSettings.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const data = {
      ...(changesChatbot ? { enabledGlobal: body.enabled, enabledWhatsapp: body.enabled } : {}),
      ...(changesPipeline ? { pipelineAutomationEnabled: body.pipelineAutomationEnabled } : {}),
    };
    const settings = existing
      ? await prisma.chatbotSettings.update({ where: { id: existing.id }, data })
      : await prisma.chatbotSettings.create({ data: { id: "global", ...data } });

    if (changesChatbot) {
      await prisma.internalActionLog.create({
        data: {
          action: body.enabled ? "ChatbotGlobalEnabled" : "ChatbotGlobalDisabled",
          metadataJson: JSON.stringify({ channel: "whatsapp", origin: "admin_ui" }),
        },
      });
    }
    if (changesPipeline) {
      await prisma.internalActionLog.create({
        data: {
          action: body.pipelineAutomationEnabled ? "PipelineAutomationEnabled" : "PipelineAutomationDisabled",
          metadataJson: JSON.stringify({ origin: "admin_ui" }),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        enabledGlobal: settings.enabledGlobal,
        enabledWhatsapp: settings.enabledWhatsapp,
        pipelineAutomationEnabled: settings.pipelineAutomationEnabled,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar interruptor global do chatbot", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
