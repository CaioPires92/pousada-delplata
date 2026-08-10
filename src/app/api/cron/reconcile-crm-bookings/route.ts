import { NextResponse } from "next/server";

import { reconcileBookingsWithKanban } from "@/lib/crm/bookingKanbanReconciliation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (!cronSecret || authorization !== `Bearer ${cronSecret}`)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await reconcileBookingsWithKanban();
  return NextResponse.json({ ok: true, ...result });
}
