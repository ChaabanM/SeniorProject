"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type WarehousePayload = {
  laborProductivity: {
    overallRate: number;
    totalItemsHandled: number;
    totalHours: number;
    topStaff: Array<{
      employeeId: string;
      weightedRate: number;
      totalHours: number;
      itemsHandled: number;
    }>;
    dailyTrend: Array<{
      date: string;
      totalItemsHandled: number;
      totalHours: number;
      rate: number;
    }>;
  };
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

export default function LaborProductivityPage() {
  const [data, setData] = useState<WarehousePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/warehouse-management")
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load warehouse data");
        return payload as WarehousePayload;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl bg-[var(--card-bg)] p-6 shadow-card border border-[color:var(--border-color)]">
        Loading labor productivity...
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl bg-[var(--card-bg)] p-6 shadow-card border border-[color:var(--border-color)]">
        Failed to load labor productivity: {error ?? "No data"}
      </section>
    );
  }

  const labor = data.laborProductivity;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold uppercase tracking-wider text-[color:var(--text-main)]">
          Labor Productivity
        </h1>
      </div>

      <section className="rounded-2xl bg-[var(--card-bg)] p-5 shadow-card border border-[color:var(--border-color)]">
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card border border-[color:var(--border-color)]">
            <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
              Total Items Handled
            </p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(labor.totalItemsHandled)}</p>
          </div>
          <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card border border-[color:var(--border-color)]">
            <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
              Total Hours
            </p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(labor.totalHours)}</p>
          </div>
          <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card border border-[color:var(--border-color)]">
            <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
              Overall Rate
            </p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(labor.overallRate)} items/hr</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-8">
          <section className="w-full min-w-0 rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-main)]">
              Employee Productivity Breakdown
            </h3>
            <div className="min-w-0 rounded-2xl chart-inner-well p-0">
              <div className="max-h-80 overflow-auto rounded-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[var(--surface-bg)] text-[11px] uppercase text-[color:var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Hours</th>
                      <th className="px-4 py-3 text-right">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labor.topStaff.map((row) => (
                      <tr key={row.employeeId} className="border-b border-[color:var(--border-color)]">
                        <td className="px-4 py-3">{row.employeeId}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.weightedRate)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.totalHours)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.itemsHandled)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="w-full min-w-0 rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-main)]">
              Daily Productivity Trend
            </h3>
            <div className="min-w-0 rounded-2xl chart-inner-well p-4">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={labor.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                    <XAxis dataKey="date" tick={{ fill: "#5B6672", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#5B6672", fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="rate" stroke="#2F6FED" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

