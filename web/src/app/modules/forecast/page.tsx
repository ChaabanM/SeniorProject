"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ForecastItem = {
  id: number;
  name: string;
};

type ForecastPoint = {
  date: string;
  actual: number | null;
  prediction: number | null;
  future: number | null;
};

type ForecastPayload = {
  datasetId: string;
  items: ForecastItem[];
  selectedItemId: number | null;
  latestRun: {
    runId: string;
    datasetId: string;
    model: string;
    wape: number | null;
    r2: number | null;
    generatedAt: string;
  } | null;
  dateInfo: {
    rawDataEndDate: string | null;
    lastHistoricalMonth: string | null;
    forecastStartDate: string | null;
  };
  chartData: ForecastPoint[];
  error?: string;
};

const fmt = (value: number | null | undefined, digits = 2) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value)
    : "N/A";

function formatMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatYearMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toMonthEnd(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function addMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth() + 2, 0).toISOString().slice(0, 10);
}

export default function ForecastPage() {
  const [payload, setPayload] = useState<ForecastPayload | null>(null);
  const [itemId, setItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const query = itemId ? `?itemId=${itemId}` : "";

    fetch(`/api/forecast${query}`)
      .then(async (res) => {
        const data = (await res.json()) as ForecastPayload;
        if (!res.ok) throw new Error(data.error ?? "Failed to load forecast");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setPayload(data);
        setError(null);
        if (!itemId && data.selectedItemId) setItemId(data.selectedItemId);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load forecast");
      })

    return () => {
      active = false;
    };
  }, [itemId]);

  const selectedItem = useMemo(
    () => payload?.items.find((item) => item.id === payload.selectedItemId) ?? null,
    [payload]
  );

  const chartData = useMemo(() => {
    const source = payload?.chartData ?? [];
    if (!source.length) return [];

    const byDate = new Map(source.map((row) => [toMonthEnd(row.date), { ...row, date: toMonthEnd(row.date) }]));
    const dates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));
    const start = dates[0];
    const end = dates[dates.length - 1];
    const filled: ForecastPoint[] = [];

    for (let date = start; date <= end; date = addMonth(date)) {
      filled.push(
        byDate.get(date) ?? {
          date,
          actual: null,
          prediction: null,
          future: null,
        }
      );
    }

    return filled;
  }, [payload]);

  const forecastStartDate = useMemo(() => {
    const firstFuture = chartData.find((row) => typeof row.future === "number");
    return firstFuture?.date ?? payload?.dateInfo.forecastStartDate ?? null;
  }, [chartData, payload]);

  const forecastTableRows = useMemo(
    () =>
      chartData
        .filter((row) => typeof row.future === "number")
        .map((row) => ({
          date: row.date,
          demand: Number(row.future ?? 0),
          model: payload?.latestRun?.model ?? "N/A",
        }))
        .slice(0, 3),
    [chartData, payload]
  );

  return (
    <div className="min-h-screen bg-dashboard px-6 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-6 shadow-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[color:var(--text-main)]">
                Demand Forecast
              </h1>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                SQL-backed AI forecasts using the same active dataset as the dashboard.
              </p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                Dataset: {payload?.datasetId ?? "Loading..."} | Forecast generated:{" "}
                {payload?.latestRun?.generatedAt ?? "Not available"} | Auto-updated daily at 01:00 AM
              </p>
            </div>

            <label className="flex min-w-[260px] flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
              Item
              <select
                value={itemId ?? ""}
                onChange={(event) => setItemId(Number(event.target.value))}
                className="rounded-lg border border-[color:var(--border-color)] bg-[var(--surface-bg)] px-3 py-2 text-sm font-medium normal-case tracking-normal text-[color:var(--text-main)]"
              >
                {(payload?.items ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} - {item.name || "Unnamed item"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Selected Item</p>
            <p className="mt-2 text-2xl font-semibold">{selectedItem?.id ?? "N/A"}</p>
            <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">
              {selectedItem?.name ?? "No item selected"}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">Best Model</p>
            <p className="mt-2 text-2xl font-semibold">{payload?.latestRun?.model ?? "Not run"}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">WAPE</p>
            <p className="mt-2 text-2xl font-semibold">
              {fmt(payload?.latestRun?.wape)}%
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-4 shadow-card">
            <p className="text-xs text-[color:var(--text-muted)]">R²</p>
            <p className="mt-2 text-2xl font-semibold">{fmt(payload?.latestRun?.r2, 3)}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider">Demand Forecast Graph</h2>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                Active dataset: {payload?.datasetId ?? "Loading"} | Generated:{" "}
                {payload?.latestRun?.generatedAt ?? "Not available"}
              </p>
            </div>
            {!payload && !error ? <p className="text-xs text-[color:var(--text-muted)]">Loading...</p> : null}
          </div>

          <div className="chart-inner-well relative mt-4 h-[520px] rounded-xl p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 28, right: 36, left: 28, bottom: 42 }}>
                <CartesianGrid stroke="#9CA3AF" strokeOpacity={0.45} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatMonth}
                  tick={{ fill: "#5B6672", fontSize: 10 }}
                  minTickGap={34}
                  height={48}
                />
                <YAxis
                  tick={{ fill: "#5B6672", fontSize: 11 }}
                  tickFormatter={(value) => fmt(Number(value), 0)}
                  allowDecimals={false}
                  label={{
                    value: "Demand",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#5B6672",
                    fontSize: 12,
                    dx: -10,
                  }}
                />
                <Tooltip
                  labelFormatter={(label) => formatMonth(String(label))}
                  formatter={(value, name) => [fmt(Number(value), 0), String(name)]}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{
                    bottom: 6,
                    fontSize: 12,
                    lineHeight: "20px",
                  }}
                  iconSize={10}
                  iconType="line"
                />
                {forecastStartDate ? (
                  <ReferenceLine
                    x={forecastStartDate}
                    stroke="#5B6672"
                    strokeDasharray="5 5"
                    label={{
                      value: "Forecast Start",
                      position: "top",
                      fill: "#5B6672",
                      fontSize: 10,
                    }}
                  />
                ) : null}
                <Line
                  type="linear"
                  dataKey="actual"
                  name="Historical Demand"
                  stroke="#2f6fed"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <Line
                  type="linear"
                  dataKey="prediction"
                  name={`Model Prediction: ${payload?.latestRun?.model ?? ""}`.trim()}
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Line
                  type="linear"
                  dataKey="future"
                  name="Future Forecast"
                  stroke="#16a34a"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {!payload?.latestRun ? (
            <p className="mt-3 text-sm text-[color:var(--text-muted)]">
              No generated forecast found yet. Run{" "}
              <code>C:\Users\alsen\Desktop\forecast-service\run_forecast_daily.bat</code> to create the latest forecast rows.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
          <h2 className="text-base font-semibold text-[color:var(--text-main)]">
            Future Forecast (Next 3 Months)
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-[color:var(--border-color)]">
            <table className="w-full border-collapse bg-[var(--surface-bg)] text-sm">
              <thead>
                <tr className="border-b border-[color:var(--border-color)] bg-[var(--card-bg)] text-[color:var(--text-muted)]">
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">Demand</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">Model</th>
                </tr>
              </thead>
              <tbody>
                {forecastTableRows.length ? (
                  forecastTableRows.map((row) => (
                    <tr key={row.date} className="border-b border-[color:var(--border-color)] last:border-b-0">
                      <td className="px-4 py-3 text-center font-medium text-[color:var(--text-main)]">
                        {formatYearMonth(row.date)}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-[color:var(--text-main)]">
                        {fmt(row.demand, 0)}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-[color:var(--text-main)]">
                        {row.model}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-sm text-[color:var(--text-muted)]"
                      colSpan={3}
                    >
                      No forecast rows available yet.
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
