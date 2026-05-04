type ComingSoonPageProps = {
  title: string;
  subtitle?: string;
};

export default function ComingSoonPage({ title, subtitle }: ComingSoonPageProps) {
  return (
    <div className="min-h-screen bg-dashboard px-6 py-10">
      <div className="mx-auto w-full max-w-6xl rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-6 shadow-card">
        <h1 className="text-2xl font-semibold text-[color:var(--text-main)]">{title}</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          {subtitle ?? "Coming soon"}
        </p>
      </div>
    </div>
  );
}

