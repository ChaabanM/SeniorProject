"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AppSidebar from "./AppSidebar";

type UserRole = "INVENTORY_MANAGER" | "PROCUREMENT_RISK_MANAGER";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthOnlyPage = pathname === "/login" || pathname === "/access-denied";

  const [role, setRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const [procurementMenuOpen, setProcurementMenuOpen] = useState(false);
  const procurementMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isAuthOnlyPage) {
      return;
    }

    let active = true;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((payload) => {
        if (!active) return;
        setRole((payload?.user?.role as UserRole | undefined) ?? null);
        setEmail(typeof payload?.user?.email === "string" ? payload.user.email : null);
        setRoleResolved(true);
      })
      .catch(() => {
        if (!active) return;
        setRole(null);
        setEmail(null);
        setRoleResolved(true);
      });

    return () => {
      active = false;
    };
  }, [isAuthOnlyPage]);

  const showSidebar = !isAuthOnlyPage && roleResolved && role !== "PROCUREMENT_RISK_MANAGER";
  const showProcurementHeader =
    !isAuthOnlyPage && roleResolved && role === "PROCUREMENT_RISK_MANAGER";

  const avatarLetter = useMemo(() => {
    const seed = (email ?? "").trim();
    const letter = seed ? seed[0] : "U";
    return letter.toUpperCase();
  }, [email]);

  useEffect(() => {
    if (!procurementMenuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const root = procurementMenuRef.current;
      const target = e.target as Node | null;
      if (!root || !target) return;
      if (root.contains(target)) return;
      setProcurementMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [procurementMenuOpen]);

  const shellClassName = useMemo(() => {
    const base = "min-h-screen bg-dashboard text-[color:var(--text-main)]";
    return base;
  }, []);

  return (
    <div className={shellClassName}>
      {showProcurementHeader ? (
        <header className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-8 pt-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 text-left">
              <h1 className="text-2xl font-semibold tracking-wide text-[color:var(--text-main)]">
                Procurement &amp; Risk Manager Dashboard
              </h1>
              <p className="text-sm leading-relaxed text-[color:var(--text-muted)]">
                Real-time supplier performance and risk monitoring
              </p>
            </div>

            <div ref={procurementMenuRef} className="relative flex shrink-0 items-center">
              <button
                type="button"
                aria-label="Open user menu"
                aria-expanded={procurementMenuOpen}
                onClick={() => setProcurementMenuOpen((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white shadow-sm"
              >
                {avatarLetter}
              </button>

              {procurementMenuOpen ? (
                <div className="absolute right-0 top-12 z-50 w-[260px] rounded-xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-3 shadow-[0_18px_40px_rgba(9,24,68,0.18)]">
                  <div className="truncate text-xs font-semibold text-[color:var(--text-main)]">
                    {email ?? ""}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
                    Procurement &amp; Risk Manager
                  </div>
                  <div className="my-2 h-px w-full bg-[color:var(--border-color)]" />
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/auth/logout", { method: "POST" });
                      window.location.href = "/login";
                    }}
                    className="w-full rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-[11px] font-semibold text-[color:var(--text-main)] hover:bg-[var(--card-bg)]"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}

      {showSidebar ? <AppSidebar /> : null}

      <main className={`min-w-0 ${showSidebar ? "md:pl-[260px]" : ""} pt-12 md:pt-0`}>
        {children}
      </main>
    </div>
  );
}

