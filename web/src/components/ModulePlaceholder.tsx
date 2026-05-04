import Link from "next/link";

type SubLink = {
  href: string;
  label: string;
};

export default function ModulePlaceholder(props: {
  title: string;
  subtitle: string;
  links: SubLink[];
}) {
  return (
    <section className="rounded-2xl bg-[var(--card-bg)] p-6 shadow-card border border-[color:var(--border-color)]">
      <h1 className="text-2xl font-semibold">{props.title}</h1>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">{props.subtitle}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {props.links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl bg-[var(--surface-bg)] px-4 py-3 text-sm font-medium text-[color:var(--text-main)]"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

