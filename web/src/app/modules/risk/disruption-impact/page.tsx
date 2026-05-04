"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type RiskDashboardPayload = {
  riskSeverityMatrix: Array<{
    riskId: string;
    riskTitle: string;
    probabilityScore: number;
    impactScore: number;
  }>;
  estimatedCostExposure: Array<{
    riskId: string;
    riskTitle: string;
    estimatedCostAed: number;
  }>;
  risksByCategory: Array<{
    riskCategory: string;
    riskCount: number;
  }>;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const formatInteger = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

type MatrixGroupPoint = {
  probabilityScore: number;
  impactScore: number;
  pointSize: number;
  label: string;
  risks: Array<{
    riskId: string;
    riskTitle: string;
    probabilityScore: number;
    impactScore: number;
  }>;
};

export default function Page() {
  const [data, setData] = useState<RiskDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/risk/dashboard")
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load risk dashboard data");
        return payload as RiskDashboardPayload;
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
        Loading risk dashboard...
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl bg-[var(--card-bg)] p-6 shadow-card border border-[color:var(--border-color)]">
        Failed to load risk dashboard: {error ?? "No data"}
      </section>
    );
  }

  const severityData: MatrixGroupPoint[] = (() => {
    const groups = new Map<string, MatrixGroupPoint>();
    for (const row of data.riskSeverityMatrix) {
      const probabilityScore = Number(row.probabilityScore);
      const impactScore = Number(row.impactScore);
      const riskId = String(row.riskId ?? "").trim();
      const riskTitle = String(row.riskTitle ?? "").trim();

      // Only plot valid risks: require id/title, and non-zero probability/impact.
      if (!riskId || !riskTitle) continue;
      if (!Number.isFinite(probabilityScore) || !Number.isFinite(impactScore)) continue;
      if (probabilityScore <= 0 || impactScore <= 0) continue;

      const key = `${row.probabilityScore}|${row.impactScore}`;
      const existing = groups.get(key);
      if (existing) {
        existing.risks.push({
          riskId,
          riskTitle,
          probabilityScore,
          impactScore,
        });
      } else {
        groups.set(key, {
          probabilityScore,
          impactScore,
          pointSize: 160,
          label: riskId,
          risks: [
            {
              riskId,
              riskTitle,
              probabilityScore,
              impactScore,
            },
          ],
        });
      }
    }

    const points = Array.from(groups.values());
    for (const p of points) {
      const count = p.risks.length;
      p.label = count === 1 ? p.risks[0].riskId : `${count} risks`;
      p.pointSize = 160;
    }
    return points;
  })();

  const renderMatrixTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: readonly unknown[];
  }) => {
    if (!active || !payload?.length) return null;
    const first = payload[0] as { payload?: MatrixGroupPoint } | undefined;
    const point = first?.payload;
    if (!point) return null;

    const sorted = [...point.risks].sort((a, b) => a.riskId.localeCompare(b.riskId));
    return (
      <div className="rounded-xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-3 shadow-card">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
          Probability {formatNumber(point.probabilityScore)} · Impact {formatNumber(point.impactScore)}
        </div>
        <div className="space-y-1 text-sm text-[color:var(--text-main)]">
          {sorted.map((r) => (
            <div key={r.riskId} className="leading-snug">
              <span className="font-semibold">{r.riskId}</span> – {r.riskTitle}{" "}
              <span className="text-xs text-[color:var(--text-muted)]">
                (P:{formatNumber(r.probabilityScore)}, I:{formatNumber(r.impactScore)})
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMatrixLabel = (props: unknown) => {
    const { x, y, value } = (props ?? {}) as {
      x?: number;
      y?: number;
      value?: string | number;
    };
    if (typeof x !== "number" || typeof y !== "number") return null;
    const text = String(value ?? "").trim();
    if (!text) return null;

    // Keep labels aligned above dots; chart margin provides headroom.
    const dy = -10;
    return (
      <text x={x} y={y + dy} fill="#5B6672" fontSize={10} textAnchor="middle">
        {text}
      </text>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold uppercase tracking-wider text-[color:var(--text-main)]">
          Risk &amp; Actions Dashboard
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-main)]">
            Estimated Cost Exposure by Risk
          </h3>
          <div className="rounded-2xl chart-inner-well p-4">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.estimatedCostExposure} margin={{ top: 18, right: 20, left: 8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EBF2" />
                <XAxis
                  dataKey="riskId"
                  tick={{ fill: "#5B6672", fontSize: 11 }}
                  label={{
                    value: "Risk",
                    position: "insideBottom",
                    fill: "#5B6672",
                    fontSize: 11,
                    dy: 12,
                  }}
                />
                <YAxis
                  tick={{ fill: "#5B6672", fontSize: 11 }}
                  tickFormatter={formatInteger}
                  label={{
                    value: "Estimated Cost (AED)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#5B6672",
                    fontSize: 11,
                    dx: -2,
                  }}
                />
                <Tooltip
                  formatter={(value) => [`${formatInteger(Number(value))} AED`, "Estimated Cost (AED)"]}
                  labelFormatter={(label, payload) => {
                    if (!payload?.length) return String(label);
                    const row = payload[0].payload as { riskId: string; riskTitle: string };
                    return `${row.riskId} - ${row.riskTitle}`;
                  }}
                />
                <Bar dataKey="estimatedCostAed" fill="#EF4444" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="estimatedCostAed"
                    position="top"
                      formatter={(value) => formatInteger(Number(value))}
                    fill="#5B6672"
                    fontSize={10}
                  />
                </Bar>
              </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-main)]">
            Risks by Category
          </h3>
          <div className="rounded-2xl chart-inner-well p-4">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.risksByCategory} margin={{ top: 18, right: 20, left: 8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EBF2" />
                <XAxis
                  dataKey="riskCategory"
                  tick={{ fill: "#5B6672", fontSize: 11 }}
                  label={{
                    value: "Risk Category",
                    position: "insideBottom",
                    fill: "#5B6672",
                    fontSize: 11,
                    dy: 12,
                  }}
                />
                <YAxis
                  tick={{ fill: "#5B6672", fontSize: 11 }}
                  allowDecimals={false}
                  label={{
                    value: "Number of Risks",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#5B6672",
                    fontSize: 11,
                    dx: -2,
                  }}
                />
                <Tooltip formatter={(value) => [formatInteger(Number(value)), "Risk Count"]} />
                <Bar dataKey="riskCount" fill="#2F6FED" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="riskCount"
                    position="top"
                      formatter={(value) => formatInteger(Number(value))}
                    fill="#5B6672"
                    fontSize={10}
                  />
                </Bar>
              </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-main)]">
          Risk Severity Matrix
        </h3>
        <div className="rounded-2xl chart-inner-well p-4">
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 30, right: 20, left: 10, bottom: 24 }}>
              <ReferenceArea
                x1={0}
                x2={2}
                y1={0}
                y2={2}
                fill="#22C55E"
                fillOpacity={0.12}
                strokeOpacity={0}
              />
              <ReferenceArea
                x1={2}
                x2={4}
                y1={2}
                y2={4}
                fill="#F59E0B"
                fillOpacity={0.1}
                strokeOpacity={0}
              />
              <ReferenceArea
                x1={4}
                x2={5}
                y1={4}
                y2={5}
                fill="#EF4444"
                fillOpacity={0.12}
                strokeOpacity={0}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#E6EBF2" />
              <XAxis
                dataKey="probabilityScore"
                type="number"
                name="Probability"
                domain={[0, 5]}
                tickCount={6}
                tick={{ fill: "#5B6672", fontSize: 11 }}
                label={{
                  value: "Probability",
                  position: "insideBottom",
                  fill: "#5B6672",
                  fontSize: 11,
                  dy: 12,
                }}
              />
              <YAxis
                dataKey="impactScore"
                type="number"
                name="Impact"
                domain={[0, 5]}
                tickCount={6}
                tick={{ fill: "#5B6672", fontSize: 11 }}
                label={{
                  value: "Impact",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#5B6672",
                  fontSize: 11,
                  dx: -2,
                }}
              />
              <ZAxis dataKey="pointSize" range={[160, 160]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={renderMatrixTooltip} />
              <Scatter data={severityData} fill="#2F6FED">
                <LabelList dataKey="label" content={renderMatrixLabel} />
              </Scatter>
            </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

