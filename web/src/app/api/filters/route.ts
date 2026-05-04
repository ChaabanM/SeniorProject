import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

export function GET() {
  const db = getDb();

  const locations = db
    .prepare(
      "SELECT location_id as id, location_name as name FROM locations ORDER BY location_name"
    )
    .all();
  const items = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      ranked_items AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS id,
          TRIM(COALESCE(ri.item_name, '')) AS name,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.item_id, '')) <> ''
      )
      SELECT
        id,
        name
      FROM ranked_items
      WHERE rn = 1
      ORDER BY id ASC
      `
    )
    .all();
  const dateRange = db
    .prepare(
      "SELECT MIN(substr(event_ts, 1, 10)) as minEnd, MAX(substr(event_ts, 1, 10)) as maxEnd FROM inventory_events"
    )
    .get();

  return NextResponse.json({
    locations,
    items,
    dateRange,
  });
}
