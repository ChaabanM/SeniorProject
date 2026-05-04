import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-dashboard text-[color:var(--text-main)]">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-wide">Access denied</h1>
        <p className="mt-3 text-[color:var(--text-muted)]">
          You don&apos;t have permission to access this page.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

