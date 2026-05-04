import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";
import { getUserByEmail } from "@/lib/authDb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Missing credentials" }, { status: 400 });
  }

  const user = getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken({ email: user.email, role: user.role });
  const res = NextResponse.json({ ok: true, user: { email: user.email, role: user.role } });
  res.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
  });
  return res;
}

