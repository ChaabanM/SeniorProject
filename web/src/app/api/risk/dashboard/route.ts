import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export const runtime = "nodejs";

type RiskRow = {
  riskId: string;
  riskTitle: string;
  riskCategory: string;
  probabilityScore: number;
  impactScore: number;
  estimatedCostAed: number;
};

export function GET() {
  try {
    const db = getDb();

    const risks = db
      .prepare(
        `
        WITH active_dataset AS (
          SELECT dataset_id
          FROM datasets
          WHERE is_active = 1
          ORDER BY imported_at DESC
          LIMIT 1
        ),
        latest_risk AS (
          SELECT
            COALESCE(NULLIF(TRIM(r.risk_code), ''), CAST(CAST(r.risk_id AS INTEGER) AS TEXT)) AS riskId,
            COALESCE(NULLIF(TRIM(r.risk_title), ''), 'Unknown Risk') AS riskTitle,
            COALESCE(NULLIF(TRIM(r.risk_category), ''), 'Uncategorized') AS riskCategory,
            COALESCE(r.probability_score, 0) AS probabilityScore,
            COALESCE(r.impact_score, 0) AS impactScore,
            COALESCE(r.estimated_cost_aed, 0) AS estimatedCostAed,
            ROW_NUMBER() OVER (
              PARTITION BY CAST(r.risk_id AS INTEGER)
              ORDER BY datetime(r.assessment_date) DESC, r.rowid DESC
            ) AS rn
          FROM raw_risk_and_actions_v r
          WHERE r.dataset_id = (SELECT dataset_id FROM active_dataset)
        )
        SELECT
          riskId,
          riskTitle,
          riskCategory,
          probabilityScore,
          impactScore,
          estimatedCostAed
        FROM latest_risk
        WHERE rn = 1
        `
      )
      .all() as RiskRow[];

    const risksByCost = [...risks].sort((a, b) => b.estimatedCostAed - a.estimatedCostAed);

    const categoryPriority = ["Delivery", "Quality", "Financial", "Regulatory"];
    const categoryMap = new Map<string, number>();
    for (const row of risks) {
      const key = row.riskCategory;
      categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1);
    }
    const risksByCategory = categoryPriority.map((category) => ({
      riskCategory: category,
      riskCount: categoryMap.get(category) ?? 0,
    }));

    return NextResponse.json({
      riskSeverityMatrix: risks.map((row) => ({
        riskId: row.riskId,
        riskTitle: row.riskTitle,
        probabilityScore: row.probabilityScore,
        impactScore: row.impactScore,
      })),
      estimatedCostExposure: risksByCost.map((row) => ({
        riskId: row.riskId,
        riskTitle: row.riskTitle,
        estimatedCostAed: row.estimatedCostAed,
      })),
      risksByCategory,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Risk dashboard API error" },
      { status: 500 }
    );
  }
}
