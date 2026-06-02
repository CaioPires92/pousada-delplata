import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { crmLog } from "@/lib/crm/logger";

type Severity = "INFO" | "WARN" | "ERROR" | "AUTOMATION" | "SECURITY";

function asNonEmptyString(value: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function inferSeverity(action: string): Severity {
  const normalized = action.toLowerCase();
  if (normalized.includes("unauthorized") || normalized.includes("security")) return "SECURITY";
  if (normalized.includes("error") || normalized.includes("failed") || normalized.includes("failure")) return "ERROR";
  if (normalized.includes("debounced") || normalized.includes("timedout") || normalized.includes("prompt") || normalized.includes("quote")) return "AUTOMATION";
  if (normalized.includes("warning") || normalized.includes("invalid")) return "WARN";
  return "INFO";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = asNonEmptyString(url.searchParams.get("action"));
    const contactId = asNonEmptyString(url.searchParams.get("contactId"));
    const conversationId = asNonEmptyString(url.searchParams.get("conversationId"));
    const severity = asNonEmptyString(url.searchParams.get("severity")) as Severity | undefined;
    const take = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get("take") ?? "100", 10) || 100));

    const logs = await prisma.internalActionLog.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(contactId ? { contactId } : {}),
        ...(conversationId ? { conversationId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        contact: { select: { id: true, name: true } },
      },
    });

    const items = logs
      .map(log => ({
        id: log.id,
        action: log.action,
        severity: inferSeverity(log.action),
        contactId: log.contactId,
        conversationId: log.conversationId,
        contactName: log.contact?.name ?? null,
        metadata: log.metadataJson ? JSON.parse(log.metadataJson) : null,
        createdAt: log.createdAt,
      }))
      .filter(item => (severity ? item.severity === severity : true));

    return NextResponse.json({ ok: true, items, count: items.length });
  } catch (error) {
    crmLog({
      level: "ERROR",
      action: "CrmEventsListFailed",
      message: "Failed to list CRM events",
      context: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
