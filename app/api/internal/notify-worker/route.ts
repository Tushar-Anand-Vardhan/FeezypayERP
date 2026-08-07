import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processDomainEventOutbox } from "@/lib/notifications/process-domain-outbox";
import { processNotificationOutbox } from "@/lib/notifications/worker";

/**
 * Cron-safe notify worker. Header: Authorization: Bearer $NOTIFY_WORKER_SECRET
 */
export async function POST(request: Request) {
  const secret = process.env.NOTIFY_WORKER_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "NOTIFY_WORKER_SECRET not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 503 },
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const domain = await processDomainEventOutbox(supabase as never, {
    limit: 50,
  });
  const delivery = await processNotificationOutbox(supabase as never, {
    limit: 100,
  });

  return NextResponse.json({ ok: true, domain, delivery });
}
