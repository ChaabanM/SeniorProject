import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

export function GET() {
  try {
    const db = getDb();

    const latestSpace = db
      .prepare(
        `
        SELECT
          w.metric_date AS metricDate,
          loc.location_name AS location,
          w.total_capacity_m3 AS effectiveCapacity,
          w.used_capacity_m3 AS occupiedVolume,
          w.occupancy_pct AS utilizationPct,
          w.notes AS notes
        FROM warehouse_space_metrics w
        LEFT JOIN locations loc ON loc.location_id = w.location_id
        ORDER BY w.metric_date DESC
        LIMIT 1
        `
      )
      .get() as
      | {
          metricDate: string;
          location: string | null;
          effectiveCapacity: number;
          occupiedVolume: number;
          utilizationPct: number;
          notes: string | null;
        }
      | undefined;

    const laborDailyTrend = db
      .prepare(
        `
        SELECT
          metric_date AS date,
          ROUND(COALESCE(SUM(units_moved), 0), 2) AS totalItemsHandled,
          ROUND(COALESCE(SUM(labor_hours), 0), 2) AS totalHours,
          ROUND(
            CASE WHEN COALESCE(SUM(labor_hours), 0) > 0
              THEN COALESCE(SUM(units_moved), 0) / SUM(labor_hours)
              ELSE 0
            END
          , 2) AS rate
        FROM labor_productivity_metrics
        GROUP BY metric_date
        ORDER BY metric_date ASC
        `
      )
      .all() as Array<{
      date: string;
      totalItemsHandled: number;
      totalHours: number;
      rate: number;
    }>;

    const topStaff = db
      .prepare(
        `
        SELECT
          supplier_name AS employeeId,
          ROUND(total_score, 2) AS weightedRate,
          notes
        FROM supplier_scores
        WHERE grade = 'WAREHOUSE_LABOR_TMP'
        ORDER BY total_score DESC
        LIMIT 10
        `
      )
      .all() as Array<{
      employeeId: string;
      weightedRate: number;
      notes: string;
    }>;

    const topStaffParsed = topStaff.map((row) => {
      const hoursMatch = row.notes?.match(/total_hours=([0-9.]+)/);
      const itemsMatch = row.notes?.match(/items=([0-9.]+)/);
      return {
        employeeId: row.employeeId,
        weightedRate: row.weightedRate,
        totalHours: hoursMatch ? Number(hoursMatch[1]) : 0,
        itemsHandled: itemsMatch ? Number(itemsMatch[1]) : 0,
      };
    });

    const overall = db
      .prepare(
        `
        SELECT
          ROUND(COALESCE(SUM(units_moved), 0), 2) AS totalItems,
          ROUND(COALESCE(SUM(labor_hours), 0), 2) AS totalHours
        FROM labor_productivity_metrics
        `
      )
      .get() as { totalItems: number; totalHours: number };

    const overallRate =
      overall.totalHours > 0 ? Number((overall.totalItems / overall.totalHours).toFixed(2)) : 0;

    const utilizationStatus =
      !latestSpace || latestSpace.utilizationPct <= 85
        ? "Healthy"
        : latestSpace.utilizationPct <= 100
          ? "Caution"
          : "Over Capacity";

    return NextResponse.json({
      spaceUtilization: latestSpace
        ? {
            metricDate: latestSpace.metricDate,
            location: latestSpace.location ?? "Main Warehouse / Central Store",
            effectiveCapacity: latestSpace.effectiveCapacity,
            occupiedVolume: latestSpace.occupiedVolume,
            utilizationPct: latestSpace.utilizationPct,
            status: utilizationStatus,
            notes: latestSpace.notes ?? "",
          }
        : null,
      laborProductivity: {
        overallRate,
        totalItemsHandled: overall.totalItems,
        totalHours: overall.totalHours,
        topStaff: topStaffParsed,
        dailyTrend: laborDailyTrend,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Warehouse management API error" },
      { status: 500 }
    );
  }
}

