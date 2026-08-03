import { NextResponse } from "next/server";
import {
  checkMetaMessagingHealth,
  metaMessagingHealthConfigFromEnv,
} from "@/lib/messaging/meta-health";
import { checkEvolutionMessagingHealth } from "@/lib/messaging/evolution-health";
import { evolutionMessagingConfigFromEnv } from "@/lib/messaging/evolution-provider";
import { messagingProviderNameFromEnv } from "@/lib/messaging/provider-factory";

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

  let provider;
  try {
    provider = messagingProviderNameFromEnv();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        provider: "unknown",
        status: "unconfigured",
      },
      { status: 503 },
    );
  }

  let health;
  try {
    health = provider === "evolution"
      ? await checkEvolutionMessagingHealth(evolutionMessagingConfigFromEnv())
      : await checkMetaMessagingHealth(metaMessagingHealthConfigFromEnv());
  } catch {
    return NextResponse.json(
      { ok: false, provider, status: "unconfigured" },
      { status: 503 },
    );
  }
  if (health.status === "healthy") {
    return NextResponse.json({
      ok: true,
      provider,
      ...health,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      provider,
      ...health,
    },
    { status: 503 },
  );
}
