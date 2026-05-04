import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getSessionCookieName(), "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

