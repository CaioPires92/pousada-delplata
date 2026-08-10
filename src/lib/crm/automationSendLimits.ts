import prisma from "@/lib/prisma";

const PROACTIVE_JOURNEYS = ["commercial_followup", "broadcast", "post_stay"];
export const DEFAULT_CONTACT_DAILY_SEND_LIMIT = 3;
export const DEFAULT_GLOBAL_DAILY_SEND_LIMIT = 200;
const LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function automationSendLimitsFromEnv(
  environment: Record<string, string | undefined> = process.env,
) {
  return {
    perContact: positiveInteger(
      environment.CRM_AUTOMATION_CONTACT_DAILY_LIMIT,
      DEFAULT_CONTACT_DAILY_SEND_LIMIT,
    ),
    global: positiveInteger(
      environment.CRM_AUTOMATION_GLOBAL_DAILY_LIMIT,
      DEFAULT_GLOBAL_DAILY_SEND_LIMIT,
    ),
  };
}

export async function checkAutomationSendLimits(input: {
  contactId: string;
  now?: Date;
  client?: typeof prisma;
  limits?: { perContact: number; global: number };
}) {
  const client = input.client ?? prisma;
  const now = input.now ?? new Date();
  const limits = input.limits ?? automationSendLimitsFromEnv();
  const windowStartedAt = new Date(now.getTime() - LIMIT_WINDOW_MS);
  const commonWhere = {
    action: "SEND_WHATSAPP_MESSAGE",
    journeyType: { in: PROACTIVE_JOURNEYS },
    status: { in: ["processing", "completed"] },
    OR: [
      { startedAt: { gte: windowStartedAt } },
      { finishedAt: { gte: windowStartedAt } },
    ],
  };
  const [contactCount, globalCount] = await Promise.all([
    client.automationQueueJob.count({
      where: {
        ...commonWhere,
        conversation: { contactId: input.contactId },
      },
    }),
    client.automationQueueJob.count({ where: commonWhere }),
  ]);

  if (globalCount > limits.global) {
    return { allowed: false as const, reason: "global_send_limit", contactCount, globalCount };
  }
  if (contactCount > limits.perContact) {
    return { allowed: false as const, reason: "contact_send_limit", contactCount, globalCount };
  }
  return { allowed: true as const, reason: null, contactCount, globalCount };
}

export function isProactiveJourney(journeyType: string | null | undefined) {
  return PROACTIVE_JOURNEYS.includes(journeyType ?? "");
}
