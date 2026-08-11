import { NextResponse } from "next/server";
import { getOperationalAlerts } from "@/lib/crm/operationalAlerts";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, alerts: await getOperationalAlerts() });
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
