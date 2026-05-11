import { NextResponse } from "next/server";

import { updatePipelineCard } from "@/lib/crm/pipelineCards";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

function getActorType(request: Request): "human" | "n8n" {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  return expectedToken && token === expectedToken ? "n8n" : "human";
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await updatePipelineCard(id, {
      ...(body as Record<string, unknown>),
      actorType: getActorType(request),
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      card: result.card,
      stageChanged: result.stageChanged,
    });
  } catch (error) {
    console.error("Erro ao atualizar card do pipeline:", error);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
