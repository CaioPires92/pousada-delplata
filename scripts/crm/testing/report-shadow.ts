import { AUTO_REPLY_INTENTS, getChatbotRuntimeSettings, type AutoReplyIntent } from "@/lib/crm/chatbotSettings";
import { evaluateAutoReplyRolloutGate } from "@/lib/crm/rolloutGate";
import prisma from "@/lib/prisma";

async function main() {
  const requestedIntent = process.argv[2] ?? "faq";
  if (!AUTO_REPLY_INTENTS.includes(requestedIntent as AutoReplyIntent)) {
    console.error(JSON.stringify({
      ok: false,
      error: "invalid_intent",
      allowedIntents: AUTO_REPLY_INTENTS,
    }));
    process.exitCode = 1;
    return;
  }

  try {
    const intent = requestedIntent as AutoReplyIntent;
    const now = new Date();
    const [gate, settings] = await Promise.all([
      evaluateAutoReplyRolloutGate(now, intent),
      getChatbotRuntimeSettings(),
    ]);

    console.log(JSON.stringify({
      ok: true,
      evaluatedAt: now.toISOString(),
      windowHours: 24,
      intent,
      rollout: {
        enabledGlobal: settings.enabledGlobal,
        enabledWhatsapp: settings.enabledWhatsapp,
        percentage: settings.autoReplyRolloutPercentage,
        releasedIntents: settings.releasedAutoReplyIntents,
      },
      gate,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

void main();
