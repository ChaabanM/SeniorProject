import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export const runtime = "nodejs";

export function GET() {
  try {
    const db = getDb();

    const items = db
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
          CAST(ri.item_id AS INTEGER) AS id,
          TRIM(ri.item_name) AS name
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND ri.item_id IS NOT NULL
          AND ri.item_name IS NOT NULL
          AND TRIM(ri.item_name) <> ''
        GROUP BY CAST(ri.item_id AS INTEGER), TRIM(ri.item_name)
        ORDER BY CAST(ri.item_id AS INTEGER) ASC
        `
      )
      .all();

    const locations = db
      .prepare(
        `
        SELECT location_id AS id, location_name AS name
        FROM locations
        ORDER BY location_name ASC
        `
      )
      .all();

    const dateRange = db
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
          MIN(date(ri.date)) AS minDate,
          MAX(date(ri.date)) AS maxDate
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
        `
      )
      .get() as { minDate: string | null; maxDate: string | null };

    return NextResponse.json({
      items,
      locations,
      dateRange,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inventory meta API error" },
      { status: 500 }
    );
  }
}

