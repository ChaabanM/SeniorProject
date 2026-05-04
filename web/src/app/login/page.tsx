"use client";

import { Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("next") || "";
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.ok) {
        setError(typeof payload?.error === "string" ? payload.error : "Login failed");
        setLoading(false);
        return;
      }

      const role = payload?.user?.role as string | undefined;
      if (role === "PROCUREMENT_RISK_MANAGER") {
        router.replace(nextPath || "/procurement");
      } else {
        router.replace(nextPath || "/");
      }
    } catch {
      setError("Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard text-[color:var(--text-main)]">
      <div className="flex min-h-screen w-full flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[520px] flex-col items-center text-center">
          <div className="w-full">
            <div className="mb-5 flex justify-center">
              <Building2 aria-hidden="true" size={80} className="text-[color:var(--accent)]" />
            </div>
            <div className="text-4xl font-semibold tracking-wide md:text-5xl">
              Hospital Inventory DDS
            </div>
            <p className="mt-3 text-base leading-relaxed text-[color:var(--text-muted)] md:text-lg">
              Secure access to inventory, supplier, warehouse, and risk insights.
            </p>
          </div>

          <div className="mt-8 w-full min-w-[380px] max-w-[420px]">
            <div className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-8 shadow-card md:p-10">
              <h1 className="text-2xl font-semibold tracking-wide md:text-3xl">Sign in</h1>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">
                Use your dashboard email and password.
              </p>

              <form className="mt-8 space-y-5" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="block text-left text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                    Email
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-xl bg-[var(--surface-bg)] px-4 py-3 text-sm text-[color:var(--text-main)] outline-none"
                    placeholder="name@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-left text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                    Password
                  </label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    className="w-full rounded-xl bg-[var(--surface-bg)] px-4 py-3 text-sm text-[color:var(--text-main)] outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Login"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

