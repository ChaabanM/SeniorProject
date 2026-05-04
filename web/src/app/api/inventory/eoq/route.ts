import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getDbWrite } from "../../../../lib/db-write";

export const runtime = "nodejs";

function getDaysInRange(periodStart: string, periodEnd: string) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      itemId?: number;
      locationId?: number;
      periodStart?: string;
      periodEnd?: string;
      orderingCostAed?: number;
      holdingRate?: number;
      leadTimeDays?: number;
    };

    const itemId = Number(body.itemId);
    const locationId = Number(body.locationId);
    const periodStart = body.periodStart;
    const periodEnd = body.periodEnd;
    const orderingCostAed = Number(body.orderingCostAed ?? 0);
    const holdingRate = Number(body.holdingRate ?? 0.2);
    const leadTimeDays = Number(body.leadTimeDays ?? 0);

    if (!itemId || !locationId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "itemId, locationId, periodStart, periodEnd are required" },
        { status: 400 }
      );
    }

    const daysInRange = getDaysInRange(periodStart, periodEnd);
    if (daysInRange <= 0) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const db = getDb();

    const rawLatest = db
      .prepare(
        `
        WITH active_dataset AS (
          SELECT dataset_id
          FROM datasets
          WHERE is_active = 1
          ORDER BY imported_at DESC
          LIMIT 1
        )
        SELECT
          TRIM(ri.item_name) AS itemName,
          COALESCE(ri.avg_usage_per_day, 0) AS avgUsagePerDay,
          COALESCE(ri.restock_lead_time, 0) AS restockLeadTime,
          COALESCE(ri.min_qty, 0) AS minQty,
          COALESCE(ri.eoq, 0) AS eoq,
          COALESCE(ri.unit_cost_large_box, 0) AS unitCostAed
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND CAST(ri.item_id AS INTEGER) = ?
          AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?
          AND date(ri.date) BETWEEN date(?) AND date(?)
        ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
        LIMIT 1
        `
      )
      .get(itemId, locationId, periodStart, periodEnd) as
      | {
          itemName: string;
          avgUsagePerDay: number;
          restockLeadTime: number;
          minQty: number;
          eoq: number;
          unitCostAed: number;
        }
      | undefined;

    if (!rawLatest) {
      return NextResponse.json(
        { error: "No active dataset rows found for selected item/location/date range" },
        { status: 404 }
      );
    }

    const storageItem = db
      .prepare(
        `
        SELECT i.item_id AS storageItemId
        FROM items i
        WHERE LOWER(TRIM(i.item_name)) = LOWER(TRIM(?))
          AND i.location_id = ?
        ORDER BY i.item_id ASC
        LIMIT 1
        `
      )
      .get(rawLatest.itemName, locationId) as { storageItemId: number } | undefined;

    if (!storageItem) {
      return NextResponse.json(
        { error: "Item not found for selected location" },
        { status: 404 }
      );
    }

    const dailyDemandAvg = Number(rawLatest.avgUsagePerDay ?? 0);
    const annualDemandQty = dailyDemandAvg * 365;
    const holdingCostAedPerUnitYear =
      Number(rawLatest.unitCostAed ?? 0) * (holdingRate > 0 ? holdingRate : 0.2);
    const reviewDate = new Date().toISOString().slice(0, 10);

    const dbWrite = getDbWrite();
    dbWrite
      .prepare(
        `
        INSERT INTO eoq_parameters
          (item_id, location_id, annual_demand_qty, ordering_cost_aed, holding_cost_aed_per_unit_year, lead_time_days, review_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        storageItem.storageItemId,
        locationId,
        annualDemandQty,
        orderingCostAed,
        holdingCostAedPerUnitYear,
        leadTimeDays,
        reviewDate,
        `period=${periodStart}..${periodEnd};holding_rate=${holdingRate}`
      );

    const eoq =
      annualDemandQty > 0 && orderingCostAed > 0 && holdingCostAedPerUnitYear > 0
        ? Math.sqrt((2 * annualDemandQty * orderingCostAed) / holdingCostAedPerUnitYear)
        : 0;
    const ordersPerYear = eoq > 0 ? annualDemandQty / eoq : 0;
    const cycleTimeDays = ordersPerYear > 0 ? 365 / ordersPerYear : 0;

    return NextResponse.json({
      itemName: rawLatest.itemName,
      annualDemandQty,
      holdingCostAedPerUnitYear,
      eoq,
      ordersPerYear,
      cycleTimeDays,
      leadTimeDays,
      orderingCostAed,
      reviewDate,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "EOQ API error" },
      { status: 500 }
    );
  }
}

