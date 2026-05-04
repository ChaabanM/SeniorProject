"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AbcLine = {
  itemId: number;
  itemName: string;
  annualQty: number;
  annualValueAed: number;
  valueSharePct: number;
  cumulativeSharePct: number;
  abcClass: "A" | "B" | "C";
};

type AbcPayload = {
  snapshot: { snapshotId: number; snapshotDate: string; periodStart: string; periodEnd: string } | null;
  lines: AbcLine[];
  kpis: { totalAnnualValue: number; totalItems: number; classAValuePct: number };
};

type MetaPayload = {
  dateRange: { minDate: string | null; maxDate: string | null };
};

const fmt = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

export default function Page() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AbcPayload | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/inventory/meta").then((r) => r.json() as Promise<MetaPayload>),
      fetch("/api/inventory/abc").then((r) => r.json() as Promise<AbcPayload>),
    ])
      .then(([meta, abc]) => {
        if (!active) return;
        if (meta.dateRange.minDate && meta.dateRange.maxDate) {
          setPeriodStart(meta.dateRange.minDate);
          setPeriodEnd(meta.dateRange.maxDate);
        }
        setData(abc);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load ABC page");
      });

    return () => {
      active = false;
    };
  }, []);

  const chartData = useMemo(
    () =>
      (data?.lines ?? []).map((row) => ({
        itemId: row.itemId,
        annualValueAed: row.annualValueAed,
        cumulativePct: row.cumulativeSharePct * 100,
      })),
    [data]
  );

  const formatCompactValue = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${Math.round(value / 1_000_000_000)}B`;
    if (abs >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
    if (abs >= 1_000) return `${Math.round(value / 1_000)}K`;
    return `${Math.round(value)}`;
  };

  const annualValueAxisMax = useMemo(() => {
    const max = chartData.reduce((acc, row) => Math.max(acc, Number(row.annualValueAed ?? 0)), 0);
    if (!max) return 0;
    const roughStep = max / 6;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;
    const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    const niceStep = niceNormalized * magnitude;
    return Math.ceil(max / niceStep) * niceStep;
  }, [chartData]);

  useEffect(() => {
    if (!chartData.length) return;
    console.log(
      "ABC Distribution X-axis item_id values:",
      chartData.map((row) => row.itemId)
    );
  }, [chartData]);

  const generateSnapshot = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/abc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd }),
      });
      const payload = (await res.json()) as AbcPayload | { error: string };
      if (!res.ok) throw new Error((payload as { error: string }).error ?? "Failed to generate");
      setData(payload as AbcPayload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate snapshot");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-6 shadow-card">
          <h1 className="text-2xl font-semibold">ABC Analysis</h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Based on ISSUE demand and annualized value contribution.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
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
            <button
              type="button"
              onClick={generateSnapshot}
              disabled={busy || !periodStart || !periodEnd}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Generating..." : "Generate Snapshot"}
            </button>
            <div className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
              {data?.snapshot
                ? `Snapshot: ${data.snapshot.snapshotDate} (${data.snapshot.periodStart} to ${data.snapshot.periodEnd})`
                : "No snapshot yet"}
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Total Annual Value (AED)</p>
            <p className="mt-2 text-2xl font-semibold">{fmt(data?.kpis.totalAnnualValue ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Total Items</p>
            <p className="mt-2 text-2xl font-semibold">{fmt(data?.kpis.totalItems ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">% Value in Class A</p>
            <p className="mt-2 text-2xl font-semibold">
              {fmt((data?.kpis.classAValuePct ?? 0) * 100)}%
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wider">ABC Distribution</h2>
          <div className="mt-3 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                barCategoryGap="14%"
                margin={{ top: 20, right: 30, left: 30, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" strokeOpacity={0.35} />
                <XAxis
                  dataKey="itemId"
                  tick={{ fill: "#5B6672", fontSize: 10 }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                  height={66}
                  label={{
                    value: "Item ID",
                    position: "insideBottom",
                    fill: "#5B6672",
                    fontSize: 10,
                    dy: 8,
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#5B6672", fontSize: 10 }}
                  tickFormatter={(v) => formatCompactValue(Number(v))}
                  domain={[0, annualValueAxisMax || "auto"]}
                  allowDecimals={false}
                  tickCount={7}
                  label={{
                    value: "Annual Consumption Value (AED)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#5B6672",
                    fontSize: 10,
                    dx: -14,
                    dy: 34,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: "#5B6672", fontSize: 10 }}
                  label={{
                    value: "Cumulative Percentage (%)",
                    angle: 90,
                    position: "insideRight",
                    fill: "#5B6672",
                    fontSize: 10,
                    dx: 10,
                    dy: 34,
                  }}
                />
                <Tooltip />
                <Bar
                  yAxisId="left"
                  dataKey="annualValueAed"
                  fill="#2F6FED"
                  name="Annual Value (AED)"
                  maxBarSize={40}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulativePct"
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Cumulative %"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wider">ABC Table</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-xs uppercase text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-2 py-2 text-left">Item Name</th>
                  <th className="px-2 py-2 text-right">Annual Qty</th>
                  <th className="px-2 py-2 text-right">Annual Value (AED)</th>
                  <th className="px-2 py-2 text-right">Value Share %</th>
                  <th className="px-2 py-2 text-right">Cumulative %</th>
                  <th className="px-2 py-2 text-center">ABC Class</th>
                </tr>
              </thead>
              <tbody>
                {(data?.lines ?? []).map((row) => (
                  <tr key={row.itemId} className="border-b border-[color:var(--border-color)]">
                    <td className="px-2 py-2">{row.itemName}</td>
                    <td className="px-2 py-2 text-right">{fmt(row.annualQty)}</td>
                    <td className="px-2 py-2 text-right">{fmt(row.annualValueAed)}</td>
                    <td className="px-2 py-2 text-right">{fmt(row.valueSharePct * 100)}%</td>
                    <td className="px-2 py-2 text-right">{fmt(row.cumulativeSharePct * 100)}%</td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold text-white ${
                          row.abcClass === "A"
                            ? "bg-red-600"
                            : row.abcClass === "B"
                              ? "bg-amber-500"
                              : "bg-emerald-600"
                        }`}
                      >
                        {row.abcClass}
                      </span>
                    </td>
                  </tr>
                ))}
                {(data?.lines.length ?? 0) === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-[color:var(--text-muted)]" colSpan={6}>
                      No snapshot lines yet. Select a date range and generate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

