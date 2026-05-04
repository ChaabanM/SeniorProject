import Link from "next/link";

const modules = [
  { href: "/inventory-management", label: "Inventory Management" },
  { href: "/warehouse-management", label: "Warehouse Management" },
  { href: "/risk-management", label: "Risk Management" },
  { href: "/vendor-management", label: "Vendor Management" },
];

export default function ModulesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-dashboard text-[color:var(--text-main)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <nav className="mb-6 flex flex-wrap gap-3">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-full bg-[var(--surface-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--text-main)]"
            >
              {module.label}
            </Link>
          ))}
          <Link
            href="/"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Overview Dashboard
          </Link>
        </nav>
        {children}
      </div>
    </div>
  );
}

