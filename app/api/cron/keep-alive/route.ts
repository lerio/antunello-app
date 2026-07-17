/**
 * Pings the Render TR service every 10 minutes to prevent cold starts.
 * Triggered by the vercel.json cron schedule.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.TR_SERVICE_URL;
  if (!url) {
    return NextResponse.json({ skipped: true, reason: 'TR_SERVICE_URL not set' });
  }

  try {
    await fetch(`${url}/health`, { signal: AbortSignal.timeout(10000) });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}
