"use client";

import { useEffect, useState } from "react";

type Option = { id: number; name: string };
type MetaPayload = {
  items: Option[];
  locations: Option[];
  dateRange: { minDate: string | null; maxDate: string | null };
};

type EoqResult = {
  itemName: string;
  annualDemandQty: number;
  holdingCostAedPerUnitYear: number;
  eoq: number;
  ordersPerYear: number;
  cycleTimeDays: number;
  leadTimeDays: number;
  orderingCostAed: number;
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
  const [orderingCostAed, setOrderingCostAed] = useState("100");
  const [holdingRate, setHoldingRate] = useState("0.2");
  const [leadTimeDays, setLeadTimeDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EoqResult | null>(null);

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
      console.log("EOQ request params", {
        itemId: Number(itemId),
        locationId: Number(locationId),
        periodStart,
        periodEnd,
      });
      const res = await fetch("/api/inventory/eoq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: Number(itemId),
          locationId: Number(locationId),
          periodStart,
          periodEnd,
          orderingCostAed: Number(orderingCostAed),
          holdingRate: Number(holdingRate),
          leadTimeDays: Number(leadTimeDays),
        }),
      });
      const payload = (await res.json()) as EoqResult | { error: string };
      if (!res.ok) throw new Error((payload as { error: string }).error ?? "EOQ calculation failed");
      setResult(payload as EoqResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "EOQ calculation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard px-6 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-6 shadow-card">
          <h1 className="text-2xl font-semibold">EOQ</h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            EOQ = sqrt((2 * D * S) / H)
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
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
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">Ordering Cost (AED)</label>
              <input
                type="number"
                step="0.01"
                value={orderingCostAed}
                onChange={(e) => setOrderingCostAed(e.target.value)}
                placeholder="Ordering cost (AED)"
                className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">Holding Rate</label>
              <input
                type="number"
                step="0.01"
                value={holdingRate}
                onChange={(e) => setHoldingRate(e.target.value)}
                placeholder="Holding rate (e.g. 0.2)"
                className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm"
              />
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
              {busy ? "Calculating..." : "Calculate EOQ"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">EOQ</p>
            <p className="mt-2 text-3xl font-bold">{fmt(result?.eoq ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Orders per Year</p>
            <p className="mt-2 text-2xl font-semibold">{fmt(result?.ordersPerYear ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Cycle Time (Days)</p>
            <p className="mt-2 text-2xl font-semibold">{fmt(result?.cycleTimeDays ?? 0)}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

