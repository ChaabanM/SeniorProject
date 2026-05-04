import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getDbWrite } from "../../../../lib/db-write";

export const runtime = "nodejs";

function getZValue(serviceLevel: string) {
  const map: Record<string, number> = {
    "90": 1.28,
    "95": 1.65,
    "97.5": 1.96,
    "99": 2.33,
  };
  return map[serviceLevel] ?? 1.65;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      itemId?: number;
      locationId?: number;
      periodStart?: string;
      periodEnd?: string;
      leadTimeDays?: number;
      serviceLevel?: string;
    };

    const itemId = Number(body.itemId);
    const locationId = Number(body.locationId);
    const periodStart = body.periodStart;
    const periodEnd = body.periodEnd;
    const leadTimeDays = Number(body.leadTimeDays ?? 0);
    const z = getZValue(String(body.serviceLevel ?? "95"));

    if (!itemId || !locationId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "itemId, locationId, periodStart, periodEnd are required" },
        { status: 400 }
      );
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
          TRIM(ri.item_name) AS itemName
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND CAST(ri.item_id AS INTEGER) = ?
          AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?
          AND date(ri.date) BETWEEN date(?) AND date(?)
        ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
        LIMIT 1
        `
      )
      .get(itemId, locationId, periodStart, periodEnd) as { itemName: string } | undefined;

    if (!rawLatest) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
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

    const dailyRows = db
      .prepare(
        `
        WITH RECURSIVE
        active_dataset AS (
          SELECT dataset_id
          FROM datasets
          WHERE is_active = 1
          ORDER BY imported_at DESC
          LIMIT 1
        ),
        date_series(day) AS (
          SELECT date(?)
          UNION ALL
          SELECT date(day, '+1 day')
          FROM date_series
          WHERE day < date(?)
        )
        SELECT
          ds.day AS day,
          COALESCE(SUM(COALESCE(ri.issues_qty, 0)), 0) AS dailyQty
        FROM date_series ds
        LEFT JOIN raw_inventory_v ri
          ON date(ri.date) = ds.day
         AND ri.dataset_id = (SELECT dataset_id FROM active_dataset)
         AND CAST(ri.item_id AS INTEGER) = ?
         AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?
        GROUP BY ds.day
        ORDER BY ds.day ASC
        `
      )
      .all(periodStart, periodEnd, itemId, locationId) as Array<{
      day: string;
      dailyQty: number;
    }>;

    const n = dailyRows.length;
    const avg = n > 0 ? dailyRows.reduce((s, r) => s + r.dailyQty, 0) / n : 0;
    const variance =
      n > 0 ? dailyRows.reduce((s, r) => s + (r.dailyQty - avg) ** 2, 0) / n : 0;
    const demandStdDev = Math.sqrt(Math.max(variance, 0));
    const safetyStock = z * demandStdDev * Math.sqrt(Math.max(leadTimeDays, 0));
    const reviewDate = new Date().toISOString().slice(0, 10);

    const dbWrite = getDbWrite();
    dbWrite
      .prepare(
        `
        INSERT INTO safety_stock_parameters
          (item_id, location_id, demand_std_dev, lead_time_days, service_level_z, review_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        storageItem.storageItemId,
        locationId,
        demandStdDev,
        leadTimeDays,
        z,
        reviewDate,
        `period=${periodStart}..${periodEnd}`
      );

    return NextResponse.json({
      itemName: rawLatest.itemName,
      demandStdDev,
      serviceLevelZ: z,
      leadTimeDays,
      safetyStock,
      reviewDate,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Safety stock API error" },
      { status: 500 }
    );
  }
}

