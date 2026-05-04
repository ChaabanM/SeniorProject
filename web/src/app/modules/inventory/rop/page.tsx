"use client";

import { useEffect, useState } from "react";

type Option = { id: number; name: string };
type MetaPayload = {
  items: Option[];
  locations: Option[];
  dateRange: { minDate: string | null; maxDate: string | null };
};
type RopResult = {
  itemName: string;
  dailyDemandAvg: number;
  leadTimeDays: number;
  safetyStockQty: number;
  rop: number;
  currentStock: number;
  status: "REORDER NOW" | "Stock OK";
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
  const [leadTimeDays, setLeadTimeDays] = useState("7");
  const [useManualSafety, setUseManualSafety] = useState(false);
  const [safetyStockQty, setSafetyStockQty] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RopResult | null>(null);

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
      console.log("ROP request params", {
        itemId: Number(itemId),
        locationId: Number(locationId),
        periodStart,
        periodEnd,
      });
      const res = await fetch("/api/inventory/rop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: Number(itemId),
          locationId: Number(locationId),
          periodStart,
          periodEnd,
          leadTimeDays: Number(leadTimeDays),
          safetyStockQty: useManualSafety ? Number(safetyStockQty) : null,
        }),
      });
      const payload = (await res.json()) as RopResult | { error: string };
      if (!res.ok) throw new Error((payload as { error: string }).error ?? "ROP calculation failed");
      setResult(payload as RopResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "ROP calculation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard px-6 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-6 shadow-card">
          <h1 className="text-2xl font-semibold">ROP</h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            ROP = (daily_demand_avg * lead_time_days) + safety_stock_qty
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
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">Safety Stock Mode</label>
              <label className="flex items-center gap-2 rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={useManualSafety}
                  onChange={(e) => setUseManualSafety(e.target.checked)}
                />
                Manual Safety Stock
              </label>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[color:var(--text-muted)]">Safety Stock Qty</label>
              <input
                type="number"
                step="0.01"
                value={safetyStockQty}
                onChange={(e) => setSafetyStockQty(e.target.value)}
                disabled={!useManualSafety}
                placeholder="Safety stock qty"
                className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={calculate}
              disabled={busy}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Calculating..." : "Calculate ROP"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Daily Demand Avg</p>
            <p className="mt-2 text-2xl font-semibold">{fmt(result?.dailyDemandAvg ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">ROP</p>
            <p className="mt-2 text-3xl font-bold">{fmt(result?.rop ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Current Stock</p>
            <p className="mt-2 text-2xl font-semibold">{fmt(result?.currentStock ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Status</p>
            <p className="mt-2">
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold text-white ${
                  result?.status === "REORDER NOW" ? "bg-red-600" : "bg-emerald-600"
                }`}
              >
                {result?.status ?? "N/A"}
              </span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

