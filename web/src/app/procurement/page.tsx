"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { ShieldAlert, TrendingUp } from "lucide-react";
import SupplierKpiDashboardPage from "../(modules)/vendor-management/supplier-kpi-dashboard/page";
import RiskDisruptionImpactPage from "../modules/risk/disruption-impact/page";

type SupplierKpiPayload = {
  overallComparison: Array<{ supplier: string; totalScore: number }>;
};

type RiskDashboardPayload = {
  riskSeverityMatrix: Array<{
    riskId: string;
    riskTitle: string;
    probabilityScore: number;
    impactScore: number;
  }>;
  estimatedCostExposure: Array<{ riskId: string; riskTitle: string; estimatedCostAed: number }>;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const formatInteger = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

type TabKey = "supplier" | "risk";

const KpiStrip = memo(function KpiStrip(props: {
  avgSupplierScore: number | null;
  highRiskCount: number | null;
  totalRiskCostAed: number | null;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card transition-shadow hover:shadow-[0_26px_60px_rgba(9,24,68,0.22)]">
        <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
          Average Supplier Score
        </p>
        <p className="mt-2 text-2xl font-semibold">
          {props.avgSupplierScore == null ? "—" : formatNumber(props.avgSupplierScore)}
        </p>
      </div>
      <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card transition-shadow hover:shadow-[0_26px_60px_rgba(9,24,68,0.22)]">
        <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
          High Risk Count
        </p>
        <p className="mt-2 text-2xl font-semibold">
          {props.highRiskCount == null ? "—" : formatInteger(props.highRiskCount)}
        </p>
      </div>
      <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card transition-shadow hover:shadow-[0_26px_60px_rgba(9,24,68,0.22)]">
        <p className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
          Total Risk Cost (AED)
        </p>
        <p className="mt-2 text-2xl font-semibold">
          {props.totalRiskCostAed == null ? "—" : formatInteger(props.totalRiskCostAed)}
        </p>
      </div>
    </section>
  );
});

export default function ProcurementHomePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("supplier");
  const [kpi, setKpi] = useState<{
    avgSupplierScore: number | null;
    highRiskCount: number | null;
    totalRiskCostAed: number | null;
  }>({ avgSupplierScore: null, highRiskCount: null, totalRiskCostAed: null });

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/vendor/kpis").then((r) => r.json()), fetch("/api/risk/dashboard").then((r) => r.json())])
      .then(([supplierPayload, riskPayload]) => {
        if (!active) return;
        const supplier = supplierPayload as SupplierKpiPayload;
        const risk = riskPayload as RiskDashboardPayload;

        const supplierScores = Array.isArray(supplier?.overallComparison)
          ? supplier.overallComparison.map((r) => Number(r.totalScore ?? 0))
          : [];
        const avgSupplierScore =
          supplierScores.length > 0
            ? supplierScores.reduce((a, b) => a + b, 0) / supplierScores.length
            : null;

        const matrix = Array.isArray(risk?.riskSeverityMatrix) ? risk.riskSeverityMatrix : [];
        const highRiskCount = matrix.filter((r) => {
          const p = Number(r?.probabilityScore ?? 0);
          const i = Number(r?.impactScore ?? 0);
          return p >= 4 && i >= 4;
        }).length;

        const exposures = Array.isArray(risk?.estimatedCostExposure) ? risk.estimatedCostExposure : [];
        const totalRiskCostAed =
          exposures.length > 0
            ? exposures.reduce((sum, r) => sum + Number(r.estimatedCostAed ?? 0), 0)
            : null;

        setKpi({ avgSupplierScore, highRiskCount, totalRiskCostAed });
      })
      .catch(() => {
        if (!active) return;
        setKpi({ avgSupplierScore: null, highRiskCount: null, totalRiskCostAed: null });
      });
    return () => {
      active = false;
    };
  }, []);

  const tabs = useMemo(
    () =>
      [
        { key: "supplier" as const, label: "Supplier KPI" },
        { key: "risk" as const, label: "Risk & Actions" },
      ] as const,
    []
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`cursor-pointer select-none rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-[1px] ${
                active
                  ? "bg-[var(--accent)] text-white shadow-card shadow-[0_12px_26px_rgba(47,111,237,0.25)] hover:bg-[color:var(--accent-hover)]"
                  : "border border-[color:var(--border-color)] bg-[var(--surface-bg)] text-[color:var(--text-main)] shadow-sm hover:bg-[#E6EBF2]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <KpiStrip
        avgSupplierScore={kpi.avgSupplierScore}
        highRiskCount={kpi.highRiskCount}
        totalRiskCostAed={kpi.totalRiskCostAed}
      />

      {/* Supplier section */}
      <section id="supplier-kpi" className={activeTab === "supplier" ? "block" : "hidden"}>
        <div className="mb-4 flex items-center gap-3">
          <TrendingUp size={22} className="text-[color:var(--accent)]" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold uppercase tracking-wider text-[color:var(--text-main)]">
              Supplier Performance
            </h2>
            <p className="text-sm text-[color:var(--text-muted)]">
              Supplier KPI insights and criteria breakdown
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-6 shadow-card transition-shadow hover:shadow-[0_26px_60px_rgba(9,24,68,0.22)]">
          <SupplierKpiDashboardPage />
        </div>
      </section>

      {/* Risk section */}
      <section id="risk-actions" className={activeTab === "risk" ? "block" : "hidden"}>
        <div className="mb-4 flex items-center gap-3">
          <ShieldAlert size={22} className="text-[color:var(--accent)]" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold uppercase tracking-wider text-[color:var(--text-main)]">
              Risk Overview
            </h2>
            <p className="text-sm text-[color:var(--text-muted)]">Cost exposure, category mix, and severity matrix</p>
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] p-6 shadow-card transition-shadow hover:shadow-[0_26px_60px_rgba(9,24,68,0.22)]">
          <RiskDisruptionImpactPage />
        </div>
      </section>
    </div>
  );
}

