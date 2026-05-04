"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SupplierKpiPayload = {
  overallComparison: Array<{
    supplier: string;
    totalScore: number;
  }>;
  criteriaBreakdown: Array<{
    supplier: string;
    qualityScore: number;
    deliveryScore: number;
    otif: number;
    costScore: number;
  }>;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

export default function SupplierKpiDashboardPage() {
  const [data, setData] = useState<SupplierKpiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/vendor/kpis")
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load supplier KPI data");
        return payload as SupplierKpiPayload;
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
        Loading supplier KPI dashboard...
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl bg-[var(--card-bg)] p-6 shadow-card border border-[color:var(--border-color)]">
        Failed to load supplier KPI dashboard: {error ?? "No data"}
      </section>
    );
  }

  const criteriaBreakdownDisplayData = data.criteriaBreakdown.map((row) => ({
    ...row,
    otifPercent: row.otif * 100,
    costScorePercent: row.costScore * 100,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold uppercase tracking-wider text-[color:var(--text-main)]">
          Supplier KPI Dashboard
        </h1>
      </div>

      <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-main)]">
          Overall Supplier Score Comparison
        </h3>
        <div className="rounded-2xl chart-inner-well p-4">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.overallComparison}
                margin={{ top: 24, right: 20, left: 8, bottom: 22 }}
                barCategoryGap="22%"
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EBF2" />
                <XAxis
                  dataKey="supplier"
                  tick={{ fill: "#5B6672", fontSize: 11 }}
                  label={{
                    value: "Supplier",
                    position: "insideBottom",
                    fill: "#5B6672",
                    fontSize: 11,
                    dy: 14,
                  }}
                />
                <YAxis
                  tick={{ fill: "#5B6672", fontSize: 11 }}
                  label={{
                    value: "Total Score",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#5B6672",
                    fontSize: 11,
                    dx: -2,
                  }}
                />
                <Tooltip formatter={(value) => [formatNumber(Number(value)), "total_score"]} />
                <Bar
                  dataKey="totalScore"
                  fill="#2F6FED"
                  name="total_score"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={80}
                >
                  <LabelList
                    dataKey="totalScore"
                    position="top"
                    formatter={(value) => formatNumber(Number(value))}
                    fill="#5B6672"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-main)]">
          Performance Breakdown by Criteria
        </h3>
        <div className="rounded-2xl chart-inner-well p-4">
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={criteriaBreakdownDisplayData}
                margin={{ top: 12, right: 20, left: 8, bottom: 72 }}
                barCategoryGap="20%"
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EBF2" />
                <XAxis
                  dataKey="supplier"
                  tick={{ fill: "#5B6672", fontSize: 11 }}
                  label={{
                    value: "Supplier",
                    position: "insideBottom",
                    fill: "#5B6672",
                    fontSize: 11,
                    dy: 16,
                  }}
                />
                <YAxis
                  tick={{ fill: "#5B6672", fontSize: 11 }}
                  label={{
                    value: "Score",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#5B6672",
                    fontSize: 11,
                    dx: -2,
                  }}
                />
                <Tooltip
                  shared={false}
                  formatter={(value, name) =>
                    name === "OTIF" || name === "Cost"
                      ? [`${formatNumber(Number(value))}%`, String(name)]
                      : [formatNumber(Number(value)), String(name)]
                  }
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: 18, fontSize: 12 }}
                  content={() => (
                    <div className="flex flex-wrap justify-center gap-4 pt-2 text-xs text-[color:var(--text-muted)]">
                      {[
                        { value: "Quality", color: "#3B82F6" },
                        { value: "Delivery", color: "#10B981" },
                        { value: "OTIF", color: "#F59E0B" },
                        { value: "Cost", color: "#8B5CF6" },
                      ].map((entry) => (
                        <div key={entry.value} className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                />
                <Bar dataKey="qualityScore" fill="#3B82F6" name="Quality" maxBarSize={28} />
                <Bar dataKey="deliveryScore" fill="#10B981" name="Delivery" />
                <Bar dataKey="otifPercent" fill="#F59E0B" name="OTIF" />
                <Bar dataKey="costScorePercent" fill="#8B5CF6" name="Cost" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

