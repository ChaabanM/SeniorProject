import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_INGESTOR_STATUS_URL = "http://127.0.0.1:5055/status";

export async function GET() {
  const statusUrl = process.env.INGESTOR_STATUS_URL || DEFAULT_INGESTOR_STATUS_URL;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(statusUrl, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, connected: false, error: `Ingestor returned ${response.status}` },
        { status: 200 }
      );
    }

    const payload = await response.json();
    return NextResponse.json({
      ok: true,
      connected: true,
      ...payload,
    });
  } catch (error: unknown) {
    return NextResponse.json({
      ok: false,
      connected: false,
      error: error instanceof Error ? error.message : "Ingestor status unavailable",
    });
  }
}
