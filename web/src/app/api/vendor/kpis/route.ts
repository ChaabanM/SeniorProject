import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export const runtime = "nodejs";

type SupplierKpiRow = {
  supplier: string;
  totalScore: number;
  qualityScore: number;
  deliveryScore: number;
  otif: number;
  costScore: number;
};

export function GET() {
  try {
    const db = getDb();

    const rows = db
      .prepare(
        `
        WITH active_dataset AS (
          SELECT dataset_id
          FROM datasets
          WHERE is_active = 1
          ORDER BY imported_at DESC
          LIMIT 1
        ),
        ranked AS (
          SELECT
            TRIM(v.supplier) AS supplier,
            COALESCE(v.total_score, 0) AS totalScore,
            COALESCE(v.quality_score, 0) AS qualityScore,
            COALESCE(v.delivery_score, 0) AS deliveryScore,
            COALESCE(v.otif, 0) AS otif,
            COALESCE(v.cost_score, 0) AS costScore,
            ROW_NUMBER() OVER (
              PARTITION BY TRIM(v.supplier)
              ORDER BY datetime(v.score_date) DESC, v.rowid DESC
            ) AS rn
          FROM raw_vendorkpi_v v
          WHERE v.dataset_id = (SELECT dataset_id FROM active_dataset)
        )
        SELECT
          supplier,
          totalScore,
          qualityScore,
          deliveryScore,
          otif,
          costScore
        FROM ranked
        WHERE rn = 1
        ORDER BY totalScore DESC, supplier ASC
        `
      )
      .all() as SupplierKpiRow[];

    return NextResponse.json({
      overallComparison: rows.map((row) => ({
        supplier: row.supplier,
        totalScore: row.totalScore,
      })),
      criteriaBreakdown: rows.map((row) => ({
        supplier: row.supplier,
        qualityScore: row.qualityScore,
        deliveryScore: row.deliveryScore,
        otif: row.otif,
        costScore: row.costScore,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Supplier KPI API error" },
      { status: 500 }
    );
  }
}
