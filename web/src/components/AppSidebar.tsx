"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Handshake,
  LayoutDashboard,
  TrendingUp,
  Warehouse,
} from "lucide-react";

type NavLink = { href: string; label: string };
type NavGroup = { title: string; links: NavLink[] };
type UserRole = "INVENTORY_MANAGER" | "PROCUREMENT_RISK_MANAGER";

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    links: [{ href: "/", label: "Overview Dashboard" }],
  },
  {
    title: "Inventory Management",
    links: [
      { href: "/modules/inventory/abc", label: "ABC Analysis" },
      { href: "/modules/inventory/eoq", label: "EOQ" },
      { href: "/modules/inventory/rop", label: "ROP" },
      { href: "/modules/inventory/safety-stock", label: "Safety Stock" },
    ],
  },
  {
    title: "Warehouse Management",
    links: [
      { href: "/modules/warehouse-management/space-utilization", label: "Warehouse Utilization" },
      { href: "/modules/warehouse-management/labor-productivity", label: "Labor Productivity" },
    ],
  },
  {
    title: "Risk Management",
    links: [
      { href: "/modules/risk/disruption-impact", label: "Risk & Actions Dashboard" },
    ],
  },
  {
    title: "Vendor Management",
    links: [
      { href: "/modules/vendor/kpis", label: "Supplier KPI Dashboard" },
    ],
  },
  {
    title: "Forecasting",
    links: [{ href: "/modules/forecast", label: "Demand Forecast" }],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((payload) => {
        if (!active) return;
        setEmail(typeof payload?.user?.email === "string" ? payload.user.email : null);
        const nextRole = payload?.user?.role;
        setRole(nextRole === "INVENTORY_MANAGER" || nextRole === "PROCUREMENT_RISK_MANAGER" ? nextRole : null);
      })
      .catch(() => {
        if (!active) return;
        setEmail(null);
        setRole(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const root = userMenuRef.current;
      const target = e.target as Node | null;
      if (!root || !target) return;
      if (root.contains(target)) return;
      setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [userMenuOpen]);

  const avatarLetter = useMemo(() => {
    const seed = (email ?? "").trim();
    const letter = seed ? seed[0] : "U";
    return letter.toUpperCase();
  }, [email]);

  const roleLabel =
    role === "PROCUREMENT_RISK_MANAGER" ? "Procurement & Risk Manager" : "Inventory & Planning Manager";

  const visibleGroups = useMemo(() => {
    if (role === "PROCUREMENT_RISK_MANAGER") {
      return navGroups.filter((g) => g.title === "Vendor Management" || g.title === "Risk Management");
    }
    return navGroups;
  }, [role]);

  const sectionIcon = useMemo(() => {
    const icons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
      Overview: LayoutDashboard,
      "Inventory Management": Boxes,
      Forecasting: TrendingUp,
      "Warehouse Management": Warehouse,
      "Risk Management": AlertTriangle,
      "Vendor Management": Handshake,
    };
    return (title: string) => icons[title];
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white md:hidden"
      >
        Menu
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close menu backdrop"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-[260px] overflow-y-auto overflow-x-hidden border-r border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 transition-transform md:z-30 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between md:hidden">
          <span className="text-sm font-semibold text-[color:var(--text-main)]">Navigation</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-xs text-[color:var(--text-muted)]"
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="hidden text-sm font-semibold text-[color:var(--text-main)] md:block">
            Inventory DSS
          </div>

          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              aria-label="Open user menu"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white shadow-sm"
            >
              {avatarLetter}
            </button>

            {userMenuOpen ? (
              <div className="absolute right-0 top-12 z-50 w-[220px] rounded-xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-3 shadow-[0_18px_40px_rgba(9,24,68,0.18)]">
                <div className="truncate text-xs font-semibold text-[color:var(--text-main)]">
                  {email ?? ""}
                </div>
                <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">{roleLabel}</div>
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

        {visibleGroups.map((group) => (
          <div key={group.title} className="mb-4">
            {(() => {
              const Icon = sectionIcon(group.title);
              return (
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  {Icon ? <Icon size={20} className="text-[color:var(--accent)]" /> : null}
                  <span>{group.title}</span>
                </div>
              );
            })()}
            <div className="space-y-2">
              {group.links.map((link) => {
                const active = isActive(pathname, link.href.split("#")[0]);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl px-3 py-2.5 text-sm font-medium leading-snug transition-colors ${
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-bg)] text-[color:var(--text-main)] hover:bg-[var(--card-bg)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </aside>
    </>
  );
}

