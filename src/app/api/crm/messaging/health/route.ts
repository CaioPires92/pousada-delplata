import { NextResponse } from "next/server";
import {
  checkMetaMessagingHealth,
  metaMessagingHealthConfigFromEnv,
} from "@/lib/messaging/meta-health";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

export async function GET(request: Request) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  if (!expectedToken || bearerToken(request) !== expectedToken) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let config;
  try {
    config = metaMessagingHealthConfigFromEnv();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        provider: "meta",
        status: "unconfigured",
      },
      { status: 503 },
    );
  }

  const health = await checkMetaMessagingHealth(config);
  if (health.status === "healthy") {
    return NextResponse.json({
      ok: true,
      provider: "meta",
      ...health,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      provider: "meta",
      ...health,
    },
    { status: 503 },
  );
}
