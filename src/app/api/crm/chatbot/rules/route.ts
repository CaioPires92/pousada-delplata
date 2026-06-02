import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

export async function GET(request: Request) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const token = getBearerToken(request);

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const trigger = searchParams.get("trigger");
  const category = searchParams.get("category");

  try {
    if (trigger) {
      const rule = await prisma.chatbotRule.findUnique({
        where: { trigger },
      });

      if (!rule) {
        return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, rule });
    }

    if (category) {
      const rules = await prisma.chatbotRule.findMany({
        where: { category, isActive: true },
      });

      return NextResponse.json({ ok: true, rules });
    }

    const rules = await prisma.chatbotRule.findMany({
      where: { isActive: true },
    });

    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    console.error("[CHATBOT_RULES_GET] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
