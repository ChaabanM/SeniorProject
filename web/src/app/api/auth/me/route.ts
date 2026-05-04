import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const token = (await cookies()).get(getSessionCookieName())?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ ok: false, user: null }, { status: 200 });
  }
  return NextResponse.json({ ok: true, user: session }, { status: 200 });
}

