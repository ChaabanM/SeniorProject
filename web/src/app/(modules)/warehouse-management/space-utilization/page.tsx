"use client";

import { useEffect, useMemo, useState } from "react";
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

type WarehousePayload = {
  spaceUtilization: {
    metricDate: string;
    location: string;
    effectiveCapacity: number;
    occupiedVolume: number;
    utilizationPct: number;
    status: "Healthy" | "Caution" | "Over Capacity";
    notes: string;
  } | null;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const formatRounded = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
const formatVolumeTick = (value: number) => {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  return `${Math.round(value)}`;
};

const PALLET_VOLUME_M3 = 1.2 * 1.0 * 1.5; // 1.8 m³

export default function SpaceUtilizationPage() {
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

  const space = data?.spaceUtilization ?? null;
  const capacityData = useMemo(() => {
    if (!space) return [];
    const capacity = Number(space.effectiveCapacity ?? 0);
    const totalVolume = Number(space.occupiedVolume ?? 0);
    const remainingCapacity = Math.max(capacity - totalVolume, 0);
    return [
      {
        warehouse: "Warehouse",
        occupiedVolume: totalVolume,
        remainingCapacity,
      },
    ];
  }, [space]);

  const palletCapacityData = useMemo(() => {
    if (!space) return [];
    const capacity = Number(space.effectiveCapacity ?? 0);
    const totalVolume = Number(space.occupiedVolume ?? 0);
    const totalPalletCapacity = capacity / PALLET_VOLUME_M3;
    const totalPalletsUsed = totalVolume / PALLET_VOLUME_M3;
    const remainingPalletCapacity = totalPalletCapacity - totalPalletsUsed;
    return [
      {
        warehouse: "Warehouse",
        occupiedPallets: Math.round(totalPalletsUsed),
        remainingPallets: Math.round(Math.max(remainingPalletCapacity, 0)),
      },
    ];
  }, [space]);

  const statusColor =
    space?.status === "Over Capacity"
      ? "text-red-600"
      : space?.status === "Caution"
        ? "text-amber-600"
        : "text-emerald-600";

  if (loading) {
    return (
      <section className="rounded-2xl bg-[var(--card-bg)] p-6 shadow-card border border-[color:var(--border-color)]">
        Loading space utilization...
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl bg-[var(--card-bg)] p-6 shadow-card border border-[color:var(--border-color)]">
        Failed to load space utilization: {error ?? "No data"}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold uppercase tracking-wider text-[color:var(--text-main)]">
          Warehouse Utilization
        </h1>
      </div>

      <section className="rounded-2xl bg-[var(--card-bg)] p-5 shadow-card border border-[color:var(--border-color)]">
        {space ? (
          <div className="flex flex-col gap-7">
            {/* KPI row */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card border border-[color:var(--border-color)]">
                <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                  Capacity (m³)
                </p>
                <p className="mt-2 text-2xl font-semibold">{formatNumber(space.effectiveCapacity)}</p>
              </div>
              <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card border border-[color:var(--border-color)]">
                <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                  Occupied Volume (m³)
                </p>
                <p className="mt-2 text-2xl font-semibold">{formatRounded(space.occupiedVolume)}</p>
              </div>
              <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card border border-[color:var(--border-color)]">
                <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                  Utilization (%)
                </p>
                <p className="mt-2 text-2xl font-semibold">{formatNumber(space.utilizationPct)}%</p>
              </div>
              <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card border border-[color:var(--border-color)]">
                <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
                  Status
                </p>
                <p className={`mt-2 text-2xl font-semibold ${statusColor}`}>{space.status}</p>
              </div>
            </div>

            {/* Chart 1 */}
            <section className="w-full min-w-0 rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-main)]">
                Warehouse Capacity Utilization
              </h3>
              <div className="min-w-0 rounded-2xl chart-inner-well p-4">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={capacityData}
                      margin={{ top: 12, right: 12, left: 12, bottom: 8 }}
                      barCategoryGap="15%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                      <XAxis dataKey="warehouse" tick={{ fill: "#5B6672", fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: "#5B6672", fontSize: 11 }}
                        tickFormatter={formatVolumeTick}
                        label={{
                          value: "Volume (m³)",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#5B6672",
                          fontSize: 11,
                          dx: -2,
                        }}
                      />
                      <Tooltip
                        formatter={(value, name) => [`${formatNumber(Number(value))} m³`, String(name)]}
                        labelFormatter={() => ""}
                      />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="top"
                        content={() => (
                          <div className="flex flex-col gap-2 text-xs text-[color:var(--text-muted)]">
                            {[
                              { value: "Occupied Volume (m³)", color: "#3B82F6" },
                              { value: "Remaining Capacity (m³)", color: "#D1D5DB" },
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
                      <Bar
                        dataKey="occupiedVolume"
                        stackId="capacity"
                        fill="#3B82F6"
                        name="Occupied Volume (m³)"
                        barSize={220}
                      />
                      <Bar
                        dataKey="remainingCapacity"
                        stackId="capacity"
                        fill="#D1D5DB"
                        name="Remaining Capacity (m³)"
                        barSize={220}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* Chart 2 */}
            <section className="w-full min-w-0 rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-5 shadow-card">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-main)]">
                Warehouse Utilization Based on Pallet Capacity
              </h3>
              <div className="min-w-0 rounded-2xl chart-inner-well p-4">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={palletCapacityData}
                      margin={{ top: 12, right: 12, left: 12, bottom: 8 }}
                      barCategoryGap="15%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                      <XAxis dataKey="warehouse" tick={{ fill: "#5B6672", fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: "#5B6672", fontSize: 11 }}
                        label={{
                          value: "Number of Pallets",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#5B6672",
                          fontSize: 11,
                          dx: -2,
                        }}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          name === "occupiedPallets"
                            ? `Occupied Pallets: ${formatRounded(Number(value))}`
                            : `Remaining Pallets: ${formatRounded(Number(value))}`,
                          "",
                        ]}
                        labelFormatter={() => ""}
                      />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="top"
                        content={() => (
                          <div className="flex flex-col gap-2 text-xs text-[color:var(--text-muted)]">
                            {[
                              { value: "Occupied Pallets", color: "#3B82F6" },
                              { value: "Remaining Pallet Capacity", color: "#D1D5DB" },
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
                      <Bar
                        dataKey="occupiedPallets"
                        stackId="pallets"
                        fill="#3B82F6"
                        name="occupiedPallets"
                        barSize={220}
                      />
                      <Bar
                        dataKey="remainingPallets"
                        stackId="pallets"
                        fill="#D1D5DB"
                        name="remainingPallets"
                        barSize={220}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <p className="text-sm text-[color:var(--text-muted)]">No space utilization data loaded yet.</p>
        )}
      </section>
    </div>
  );
}

