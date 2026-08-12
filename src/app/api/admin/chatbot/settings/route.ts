import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import {
  AUTO_REPLY_INTENTS,
  buildAutoReplyRolloutPreview,
  getChatbotRuntimeSettings,
  parseReleasedAutoReplyIntents,
} from "@/lib/crm/chatbotSettings";
import { evaluateAutoReplyRolloutGate } from "@/lib/crm/rolloutGate";

async function authorize() {
  const auth = await requireAdminAuth();
  return auth instanceof NextResponse ? { response: auth } : { auth };
}

export async function GET() {
  try {
    const authorization = await authorize();
    if (authorization.response) return authorization.response;
    const [settings, rolloutGate, intentGateEntries, openWhatsappConversations] = await Promise.all([
      getChatbotRuntimeSettings(),
      evaluateAutoReplyRolloutGate(),
      Promise.all(AUTO_REPLY_INTENTS.map(async intent => [
        intent,
        await evaluateAutoReplyRolloutGate(new Date(), intent),
      ] as const)),
      prisma.conversation.findMany({
        where: { channel: "whatsapp", status: "open", chatbotTestEnabled: false },
        select: { id: true },
      }),
    ]);
    const conversationIds = openWhatsappConversations.map(conversation => conversation.id);
    const nextPercentage = Math.min(100, settings.autoReplyRolloutPercentage + 5);
    return NextResponse.json({
      ok: true,
      settings,
      rolloutGate,
      intentGates: Object.fromEntries(intentGateEntries),
      rolloutPreview: {
        current: buildAutoReplyRolloutPreview(conversationIds, settings.autoReplyRolloutPercentage),
        nextIncrement: buildAutoReplyRolloutPreview(conversationIds, nextPercentage),
      },
    });
  } catch (error) {
    console.error("Erro ao carregar interruptor global do chatbot", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authorization = await authorize();
    if (authorization.response) return authorization.response;
    const body = await request.json().catch(() => null);
    const changesChatbot = body && typeof body.enabled === "boolean";
    const changesPipeline = body && typeof body.pipelineAutomationEnabled === "boolean";
    const changesIntents = body && Array.isArray(body.releasedAutoReplyIntents);
    const changesPercentage = body && Object.prototype.hasOwnProperty.call(body, "autoReplyRolloutPercentage");
    const allowedIntents = new Set<string>(AUTO_REPLY_INTENTS);
    const releasedAutoReplyIntents = changesIntents
      ? Array.from(new Set(body.releasedAutoReplyIntents))
      : null;
    if (
      !changesChatbot
      && !changesPipeline
      && !changesIntents
      && !changesPercentage
    ) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }
    if (releasedAutoReplyIntents?.some(intent => typeof intent !== "string" || !allowedIntents.has(intent))) {
      return NextResponse.json({ ok: false, error: "invalid_intent" }, { status: 400 });
    }
    if (
      changesPercentage
      && (typeof body.autoReplyRolloutPercentage !== "number"
        || !Number.isInteger(body.autoReplyRolloutPercentage)
        || body.autoReplyRolloutPercentage < 0
        || body.autoReplyRolloutPercentage > 100)
    ) {
      return NextResponse.json({ ok: false, error: "invalid_percentage" }, { status: 400 });
    }

    const existing = await prisma.chatbotSettings.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, autoReplyIntentsJson: true, autoReplyRolloutPercentage: true },
    });
    const previousIntents = parseReleasedAutoReplyIntents(existing?.autoReplyIntentsJson);
    const previousPercentage = existing?.autoReplyRolloutPercentage ?? 0;
    const addedIntents = changesIntents
      ? releasedAutoReplyIntents!.filter(intent => !previousIntents.includes(intent as never))
      : [];
    const increasesPercentage = changesPercentage && body.autoReplyRolloutPercentage > previousPercentage;
    if (addedIntents.length > 1) {
      return NextResponse.json({ ok: false, error: "one_intent_at_a_time" }, { status: 400 });
    }
    if (increasesPercentage && body.autoReplyRolloutPercentage > previousPercentage + 5) {
      return NextResponse.json({ ok: false, error: "rollout_increment_too_large" }, { status: 400 });
    }
    if (addedIntents.length > 0 || increasesPercentage) {
      const intentsToValidate = addedIntents.length > 0
        ? addedIntents
        : previousIntents;
      const gates = await Promise.all(intentsToValidate.map(intent =>
        evaluateAutoReplyRolloutGate(new Date(), intent as typeof AUTO_REPLY_INTENTS[number])
      ));
      const blockedIndex = gates.findIndex(gate => !gate.approved);
      if (blockedIndex >= 0) {
        return NextResponse.json({
          ok: false,
          error: "rollout_gate_blocked",
          intent: intentsToValidate[blockedIndex],
          gate: gates[blockedIndex],
        }, { status: 409 });
      }
    }
    const data = {
      ...(changesChatbot ? { enabledGlobal: body.enabled, enabledWhatsapp: body.enabled } : {}),
      ...(changesPipeline ? { pipelineAutomationEnabled: body.pipelineAutomationEnabled } : {}),
      ...(changesIntents ? { autoReplyIntentsJson: JSON.stringify(releasedAutoReplyIntents) } : {}),
      ...(changesPercentage ? { autoReplyRolloutPercentage: body.autoReplyRolloutPercentage } : {}),
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
    if (changesIntents) {
      await prisma.internalActionLog.create({
        data: {
          action: "AutoReplyIntentRolloutUpdated",
          userId: authorization.auth.adminId,
          metadataJson: JSON.stringify({
            origin: "admin_ui",
            releasedAutoReplyIntents,
          }),
        },
      });
    }
    if (changesPercentage) {
      await prisma.internalActionLog.create({
        data: {
          action: "AutoReplyRolloutPercentageUpdated",
          userId: authorization.auth.adminId,
          metadataJson: JSON.stringify({
            origin: "admin_ui",
            percentage: body.autoReplyRolloutPercentage,
          }),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        enabledGlobal: settings.enabledGlobal,
        enabledWhatsapp: settings.enabledWhatsapp,
        pipelineAutomationEnabled: settings.pipelineAutomationEnabled,
        releasedAutoReplyIntents: parseReleasedAutoReplyIntents(settings.autoReplyIntentsJson),
        autoReplyRolloutPercentage: settings.autoReplyRolloutPercentage,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar interruptor global do chatbot", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
