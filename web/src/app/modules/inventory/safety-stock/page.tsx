"use client";

import { useEffect, useState } from "react";

type Option = { id: number; name: string };
type MetaPayload = {
  items: Option[];
  locations: Option[];
  dateRange: { minDate: string | null; maxDate: string | null };
};
type SafetyResult = {
  itemName: string;
  demandStdDev: number;
  serviceLevelZ: number;
  leadTimeDays: number;
  safetyStock: number;
  reviewDate: string;
};

const fmt = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

export default function Page() {
  const [items, setItems] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [itemId, setItemId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [serviceLevel, setServiceLevel] = useState("95");
  const [leadTimeDays, setLeadTimeDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SafetyResult | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/inventory/meta")
      .then((r) => r.json() as Promise<MetaPayload>)
      .then((meta) => {
        if (!active) return;
        setItems(meta.items);
        setLocations(meta.locations);
        if (meta.items[0]) setItemId(String(meta.items[0].id));
        if (meta.locations[0]) setLocationId(String(meta.locations[0].id));
        if (meta.dateRange.minDate && meta.dateRange.maxDate) {
          setPeriodStart(meta.dateRange.minDate);
          setPeriodEnd(meta.dateRange.maxDate);
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load metadata");
      });
    return () => {
      active = false;
    };
  }, []);

  const calculate = async () => {
    setBusy(true);
    setError(null);
    try {
      console.log("Safety Stock request params", {
        itemId: Number(itemId),
        locationId: Number(locationId),
        periodStart,
        periodEnd,
      });
      const res = await fetch("/api/inventory/safety-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: Number(itemId),
          locationId: Number(locationId),
          periodStart,
          periodEnd,
          serviceLevel,
          leadTimeDays: Number(leadTimeDays),
        }),
      });
      const payload = (await res.json()) as SafetyResult | { error: string };
      if (!res.ok) throw new Error((payload as { error: string }).error ?? "Safety stock failed");
      setResult(payload as SafetyResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Safety stock failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard px-6 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-6 shadow-card">
          <h1 className="text-2xl font-semibold">Safety Stock</h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            SafetyStock = Z * demand_std_dev * sqrt(lead_time_days)
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">Item</label>
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {`${item.id} - ${item.name}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">Start Date</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">End Date</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">Service Level</label>
              <select
                value={serviceLevel}
                onChange={(e) => setServiceLevel(e.target.value)}
                className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
              >
                <option value="90">90%</option>
                <option value="95">95%</option>
                <option value="97.5">97.5%</option>
                <option value="99">99%</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">Lead Time (Days)</label>
              <input
                type="number"
                step="0.01"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                placeholder="Lead time (days)"
                className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={calculate}
              disabled={busy}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Calculating..." : "Calculate Safety Stock"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Demand Std Dev</p>
            <p className="mt-2 text-2xl font-semibold">{fmt(result?.demandStdDev ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Safety Stock</p>
            <p className="mt-2 text-3xl font-bold">{fmt(result?.safetyStock ?? 0)}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

