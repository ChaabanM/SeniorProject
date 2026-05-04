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
      leadTimeDays?: number;
      safetyStockQty?: number | null;
    };

    const itemId = Number(body.itemId);
    const locationId = Number(body.locationId);
    const periodStart = body.periodStart;
    const periodEnd = body.periodEnd;
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
          COALESCE(ri.closing_qty, 0) AS closingQty
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
          closingQty: number;
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
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const dailyDemandAvg = Number(rawLatest.avgUsagePerDay ?? 0);

    let safetyStockQty =
      body.safetyStockQty === null || body.safetyStockQty === undefined
        ? NaN
        : Number(body.safetyStockQty);

    if (!Number.isFinite(safetyStockQty)) {
      const latestSafety = db
        .prepare(
          `
          SELECT demand_std_dev AS demandStdDev, lead_time_days AS leadTimeDays, service_level_z AS z
          FROM safety_stock_parameters
          WHERE item_id = ? AND location_id = ?
          ORDER BY safety_stock_id DESC
          LIMIT 1
          `
        )
        .get(itemId, locationId) as
        | { demandStdDev: number; leadTimeDays: number; z: number }
        | undefined;

      if (latestSafety) {
        safetyStockQty =
          latestSafety.z *
          latestSafety.demandStdDev *
          Math.sqrt(Math.max(latestSafety.leadTimeDays, 0));
      } else {
        safetyStockQty = 0;
      }
    }

    const currentStock = Number(rawLatest.closingQty ?? 0);
    const rop = dailyDemandAvg * leadTimeDays + safetyStockQty;
    const status = currentStock <= rop ? "REORDER NOW" : "Stock OK";
    const reviewDate = new Date().toISOString().slice(0, 10);

    const dbWrite = getDbWrite();
    dbWrite
      .prepare(
        `
        INSERT INTO rop_parameters
          (item_id, location_id, daily_demand_avg, lead_time_days, safety_stock_qty, review_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        storageItem.storageItemId,
        locationId,
        dailyDemandAvg,
        leadTimeDays,
        safetyStockQty,
        reviewDate,
        `period=${periodStart}..${periodEnd}`
      );

    return NextResponse.json({
      itemName: rawLatest.itemName,
      dailyDemandAvg,
      leadTimeDays,
      safetyStockQty,
      rop,
      currentStock,
      status,
      reviewDate,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ROP API error" },
      { status: 500 }
    );
  }
}

