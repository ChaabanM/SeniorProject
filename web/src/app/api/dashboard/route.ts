import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

type Filters = {
  start: string;
  end: string;
  locationId?: number;
  itemId?: number;
  eventType?: string;
  eventLocation?: string;
  eventItemId?: number;
  eventFeedFull?: boolean;
};

function parseFilters(request: Request): Filters {
  const url = new URL(request.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  const locationId = url.searchParams.get("locationId");
  const itemId = url.searchParams.get("itemId") ?? "";
  const eventType = (url.searchParams.get("eventType") ?? "").trim().toUpperCase();
  const eventLocation = (url.searchParams.get("eventLocation") ?? "").trim().toUpperCase();
  const eventItemId = url.searchParams.get("eventItemId") ?? "";
  const eventFeedFull = (url.searchParams.get("eventFeedFull") ?? "").trim() === "1";

  return {
    start,
    end,
    locationId: locationId ? Number(locationId) : undefined,
    itemId: itemId ? Number(itemId) : undefined,
    eventType: eventType || undefined,
    eventLocation: eventLocation || undefined,
    eventItemId: eventItemId ? Number(eventItemId) : undefined,
    eventFeedFull,
  };
}

function buildEventWhere(alias: string, filters: Filters) {
  const parts: string[] = [];
  const params: Array<string | number> = [];

  if (filters.start && filters.end) {
    parts.push(`substr(${alias}.event_ts, 1, 10) BETWEEN ? AND ?`);
    params.push(filters.start, filters.end);
  }
  if (filters.locationId) {
    parts.push(`${alias}.location_id = ?`);
    params.push(filters.locationId);
  }
  if (filters.itemId) {
    parts.push(`${alias}.item_id = ?`);
    params.push(filters.itemId);
  }

  return {
    sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "",
    params,
  };
}

function buildItemWhere(alias: string, filters: Filters) {
  const parts: string[] = [];
  const params: Array<string | number> = [];

  if (filters.locationId) {
    parts.push(`${alias}.location_id = ?`);
    params.push(filters.locationId);
  }
  if (filters.itemId) {
    parts.push(`${alias}.item_id = ?`);
    params.push(filters.itemId);
  }

  return {
    sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "",
    params,
  };
}

function buildRawSnapshotWhere(alias: string, filters: Filters) {
  const parts: string[] = [];
  const params: Array<string | number> = [];

  if (filters.locationId) {
    parts.push(`CAST(REPLACE(UPPER(${alias}.location_id), 'LOC', '') AS INTEGER) = ?`);
    params.push(filters.locationId);
  }
  if (filters.itemId) {
    parts.push(`CAST(${alias}.item_id AS INTEGER) = ?`);
    params.push(filters.itemId);
  }

  return {
    sql: parts.length ? `AND ${parts.join(" AND ")}` : "",
    params,
  };
}

export function GET(request: Request) {
  try {
    const db = getDb();
    const filters = parseFilters(request);
    const activeFilters = { ...filters };

  if (!activeFilters.start || !activeFilters.end) {
    const range = db
      .prepare(
        "SELECT MIN(substr(event_ts, 1, 10)) as minEnd, MAX(substr(event_ts, 1, 10)) as maxEnd FROM inventory_events"
      )
      .get() as { minEnd: string | null; maxEnd: string | null };
    activeFilters.start = range.minEnd ?? "";
    activeFilters.end = range.maxEnd ?? "";
  }

  const itemWhere = buildItemWhere("i", activeFilters);
  const eventWhere = buildEventWhere("e", activeFilters);
  const rawSnapshotWhere = buildRawSnapshotWhere("ri", activeFilters);

  const inventorySummary = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${rawSnapshotWhere.sql}
      )
      SELECT
        COALESCE(SUM(CASE WHEN ls.rn = 1 THEN 1 ELSE 0 END), 0) AS items,
        COALESCE(COUNT(DISTINCT CASE WHEN ls.rn = 1 THEN ls.location_id END), 0) AS locations,
        COALESCE(COUNT(DISTINCT CASE WHEN ls.rn = 1 THEN ls.item_id END), 0) AS categories
      FROM latest_snapshot ls
      `
    )
    .get(...rawSnapshotWhere.params) as {
    items: number;
    locations: number;
    categories: number;
  };

  const availability = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          COALESCE(ri.closing_qty, 0) AS closing_qty,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${rawSnapshotWhere.sql}
      )
      SELECT
        COALESCE(SUM(CASE WHEN ls.closing_qty > 0 THEN 1 ELSE 0 END), 0) AS availableItems
      FROM latest_snapshot ls
      WHERE ls.rn = 1;
      `
    )
    .get(...rawSnapshotWhere.params) as { availableItems: number };

  const reorderRisk = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          COALESCE(ri.closing_qty, 0) AS closing_qty,
          COALESCE(ri.min_qty, 0) AS min_qty,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${activeFilters.start && activeFilters.end ? "AND substr(ri.date, 1, 10) BETWEEN ? AND ?" : ""}
          ${activeFilters.locationId ? "AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?" : ""}
          ${activeFilters.itemId ? "AND CAST(ri.item_id AS INTEGER) = ?" : ""}
      )
      SELECT
        COALESCE(SUM(CASE WHEN ls.closing_qty <= ls.min_qty THEN 1 ELSE 0 END), 0) AS reorderRiskItems,
        COUNT(*) AS totalRows
      FROM latest_snapshot ls
      WHERE ls.rn = 1;
      `
    )
    .get(
      ...(activeFilters.start && activeFilters.end ? [activeFilters.start, activeFilters.end] : []),
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : [])
    ) as { reorderRiskItems: number; totalRows: number };

  const stockStatus = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          ri.item_name AS item_name,
          COALESCE(ri.closing_qty, 0) AS closing_qty,
          COALESCE(ri.min_qty, 0) AS min_qty,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${rawSnapshotWhere.sql}
      )
      SELECT
        COALESCE(SUM(CASE WHEN ls.closing_qty > ls.min_qty THEN 1 ELSE 0 END), 0) AS inStock,
        COALESCE(
          SUM(CASE WHEN ls.closing_qty > 0 AND ls.closing_qty <= ls.min_qty THEN 1 ELSE 0 END),
          0
        ) AS lowStock,
        COALESCE(SUM(CASE WHEN ls.closing_qty = 0 THEN 1 ELSE 0 END), 0) AS outStock
      FROM latest_snapshot ls
      WHERE ls.rn = 1;
      `
    )
    .get(...rawSnapshotWhere.params) as { inStock: number; lowStock: number; outStock: number };

  const stockByLocation = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          ri.item_name AS item_name,
          COALESCE(ri.closing_qty, 0) AS closing_qty,
          COALESCE(ri.min_qty, 0) AS min_qty,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${rawSnapshotWhere.sql}
      )
      SELECT
        ls.location_id AS locationId,
        printf('LOC%02d', ls.location_id) AS location,
        COUNT(1) AS totalItems,
        COALESCE(SUM(CASE WHEN ls.closing_qty > ls.min_qty THEN 1 ELSE 0 END), 0) AS inStock,
        COALESCE(
          SUM(CASE WHEN ls.closing_qty > 0 AND ls.closing_qty <= ls.min_qty THEN 1 ELSE 0 END),
          0
        ) AS lowStock,
        COALESCE(SUM(CASE WHEN ls.closing_qty = 0 THEN 1 ELSE 0 END), 0) AS outStock
      FROM latest_snapshot ls
      WHERE ls.rn = 1
      GROUP BY ls.location_id
      ORDER BY outStock DESC, lowStock DESC;
      `
    )
    .all(...rawSnapshotWhere.params);

  const totalCurrentQtyByLocation = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_inventory AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          ri.item_name AS item_name,
          ri.closing_qty AS closing_qty,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${rawSnapshotWhere.sql}
      )
      SELECT
        li.location_id AS locationId,
        printf('LOC%02d', li.location_id) AS location,
        COALESCE(ROUND(SUM(li.closing_qty), 0), 0) AS totalCurrentQty
      FROM latest_inventory li
      WHERE li.rn = 1
      GROUP BY li.location_id
      ORDER BY totalCurrentQty DESC;
      `
    )
    .all(...rawSnapshotWhere.params);

  const stockStatusByItemLocationParams: Array<string | number> = [];
  const stockStatusByItemLocationWhere: string[] = [
    "ri.dataset_id = (SELECT dataset_id FROM active_dataset)",
    "TRIM(COALESCE(ri.location_id, '')) <> ''",
  ];
  if (activeFilters.start && activeFilters.end) {
    stockStatusByItemLocationWhere.push("substr(ri.date, 1, 10) BETWEEN ? AND ?");
    stockStatusByItemLocationParams.push(activeFilters.start, activeFilters.end);
  }
  if (activeFilters.locationId) {
    stockStatusByItemLocationWhere.push(
      "CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?"
    );
    stockStatusByItemLocationParams.push(activeFilters.locationId);
  }
  if (activeFilters.itemId) {
    stockStatusByItemLocationWhere.push("CAST(ri.item_id AS INTEGER) = ?");
    stockStatusByItemLocationParams.push(activeFilters.itemId);
  }

  const stockStatusByItemLocation = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS Item_ID,
          UPPER(TRIM(ri.location_id)) AS location_id,
          COALESCE(ri.closing_qty, 0) AS closing_qty,
          COALESCE(ri.min_qty, 0) AS min_qty,
          substr(ri.date, 1, 10) AS Date,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), UPPER(TRIM(ri.location_id))
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ${stockStatusByItemLocationWhere.join(" AND ")}
      )
      SELECT
        ls.Item_ID AS Item_ID,
        ls.location_id AS location_id,
        ls.closing_qty AS closing_qty,
        ls.min_qty AS min_qty,
        ls.Date AS Date,
        CASE
          WHEN ls.closing_qty <= 0 THEN 'Out of Stock'
          WHEN ls.closing_qty <= ls.min_qty THEN 'Low Stock'
          ELSE 'In Stock'
        END AS stock_status,
        CASE
          WHEN ls.closing_qty = 0 THEN 0.1
          ELSE ls.closing_qty
        END AS display_closing_qty
      FROM latest_snapshot ls
      WHERE ls.rn = 1
      ORDER BY ls.Item_ID ASC, ls.location_id ASC;
      `
    )
    .all(...stockStatusByItemLocationParams);

  const stockoutByCategory = db
    .prepare(
      `
      SELECT c.category_name AS category, COUNT(*) AS count
      FROM items i
      JOIN categories c ON c.category_id = i.category_id
      ${itemWhere.sql ? `${itemWhere.sql} AND i.current_qty = 0` : "WHERE i.current_qty = 0"}
      GROUP BY c.category_name
      ORDER BY count DESC;
      `
    )
    .all(...itemWhere.params) as Array<{ category: string; count: number }>;

  const reorderRiskByCategory = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          ri.item_name AS item_name,
          COALESCE(ri.closing_qty, 0) AS closing_qty,
          COALESCE(ri.min_qty, 0) AS min_qty,
          ri.avg_usage_per_day AS avg_usage_per_day,
          ri.restock_lead_time AS restock_lead_time,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${rawSnapshotWhere.sql}
      ),
      risk_scored AS (
        SELECT
          ls.item_id,
          ls.item_name,
          CASE
            WHEN ls.avg_usage_per_day IS NOT NULL
              AND ls.restock_lead_time IS NOT NULL
              AND ls.closing_qty <= (ls.avg_usage_per_day * ls.restock_lead_time)
            THEN 1
            WHEN ls.closing_qty <= ls.min_qty THEN 1
            ELSE 0
          END AS is_at_risk
        FROM latest_snapshot ls
        WHERE ls.rn = 1
      )
      SELECT
        rs.item_name AS category,
        SUM(rs.is_at_risk) AS count,
        COUNT(*) AS totalRows,
        ROUND((SUM(rs.is_at_risk) * 100.0) / COUNT(*), 0) AS riskPercentage
      FROM risk_scored rs
      GROUP BY rs.item_id, rs.item_name
      HAVING SUM(rs.is_at_risk) > 0
      ORDER BY count DESC, rs.item_name ASC;
      `
    )
    .all(...rawSnapshotWhere.params) as Array<{
    category: string;
    count: number;
    totalRows: number;
    riskPercentage: number;
  }>;

  const stockAvailabilityScope = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${rawSnapshotWhere.sql}
      )
      SELECT COUNT(*) AS totalItems
      FROM latest_snapshot ls
      WHERE ls.rn = 1;
      `
    )
    .get(...rawSnapshotWhere.params) as { totalItems: number };

  const movementTotals = db
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
        COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(ri.event_type, ''))) = 'RECEIPT' THEN COALESCE(ri.quantity, 0) ELSE 0 END), 0) AS receipts,
        COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(ri.event_type, ''))) = 'ISSUE' THEN ABS(COALESCE(ri.quantity, 0)) ELSE 0 END), 0) AS issues
      FROM raw_inventory_v ri
      WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
        ${activeFilters.start && activeFilters.end ? "AND substr(ri.event_time_stamps, 1, 10) BETWEEN ? AND ?" : ""}
        ${activeFilters.locationId ? "AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?" : ""}
        ${activeFilters.itemId ? "AND CAST(ri.item_id AS INTEGER) = ?" : ""};
      `
    )
    .get(
      ...(activeFilters.start && activeFilters.end ? [activeFilters.start, activeFilters.end] : []),
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : [])
    ) as { receipts: number; issues: number };

  const netMovement = movementTotals.receipts - movementTotals.issues;

  const movementByLocationParams: Array<string | number> = [];
  if (activeFilters.start && activeFilters.end) {
    movementByLocationParams.push(activeFilters.start, activeFilters.end);
  }
  if (activeFilters.itemId) {
    movementByLocationParams.push(activeFilters.itemId);
  }
  if (activeFilters.locationId) {
    movementByLocationParams.push(activeFilters.locationId);
  }

  const movementByLocation = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      )
      SELECT loc.location_name AS location,
        COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(ri.event_type, ''))) = 'RECEIPT' THEN COALESCE(ri.quantity, 0) ELSE 0 END), 0) AS receipts,
        COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(ri.event_type, ''))) = 'ISSUE' THEN ABS(COALESCE(ri.quantity, 0)) ELSE 0 END), 0) AS issues,
        COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(ri.event_type, ''))) = 'RECEIPT' THEN COALESCE(ri.quantity, 0) ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(ri.event_type, ''))) = 'ISSUE' THEN ABS(COALESCE(ri.quantity, 0)) ELSE 0 END), 0) AS netMovement
      FROM locations loc
      LEFT JOIN raw_inventory_v ri
        ON CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = loc.location_id
        AND ri.dataset_id = (SELECT dataset_id FROM active_dataset)
        ${activeFilters.start && activeFilters.end ? "AND substr(ri.event_time_stamps, 1, 10) BETWEEN ? AND ?" : ""}
        ${activeFilters.itemId ? "AND CAST(ri.item_id AS INTEGER) = ?" : ""}
      ${activeFilters.locationId ? "WHERE loc.location_id = ?" : ""}
      GROUP BY loc.location_id
      ORDER BY receipts DESC;
      `
    )
    .all(...movementByLocationParams);

  const consumptionTotals = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(ABS(e.quantity)), 0) AS totalQty,
        COALESCE(SUM(ABS(e.quantity) * e.unit_cost_aed), 0) AS totalCost
      FROM inventory_events e
      JOIN items i ON i.item_id = e.item_id
      ${eventWhere.sql}
      AND e.event_type = 'ISSUE';
      `
    )
    .get(...eventWhere.params) as { totalQty: number; totalCost: number };

  const consumptionQtyByLocation = db
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
        substr(ri.date, 1, 10) AS date,
        UPPER(TRIM(ri.location_id)) AS locationId,
        COALESCE(SUM(COALESCE(ri.issues_qty, 0)), 0) AS qty
      FROM raw_inventory_v ri
      WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
        AND TRIM(COALESCE(ri.location_id, '')) <> ''
        ${activeFilters.start && activeFilters.end ? "AND substr(ri.date, 1, 10) BETWEEN ? AND ?" : ""}
        ${activeFilters.locationId ? "AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?" : ""}
        ${activeFilters.itemId ? "AND CAST(ri.item_id AS INTEGER) = ?" : ""}
      GROUP BY substr(ri.date, 1, 10), UPPER(TRIM(ri.location_id))
      ORDER BY date ASC, locationId ASC;
      `
    )
    .all(
      ...(activeFilters.start && activeFilters.end ? [activeFilters.start, activeFilters.end] : []),
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : [])
    );

  const consumptionCostByLocation = db
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
        UPPER(TRIM(ri.location_id)) AS location,
        COALESCE(SUM(COALESCE(ri.inventory_value, 0)), 0) AS totalValue,
        COALESCE(SUM(COALESCE(ri.issues_qty, 0)), 0) AS totalIssues,
        CASE
          WHEN COALESCE(SUM(COALESCE(ri.issues_qty, 0)), 0) = 0 THEN 0
          ELSE COALESCE(SUM(COALESCE(ri.inventory_value, 0)), 0) /
               COALESCE(SUM(COALESCE(ri.issues_qty, 0)), 0)
        END AS avgCostPerUnit
      FROM raw_inventory_v ri
      WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
        AND TRIM(COALESCE(ri.location_id, '')) <> ''
        ${activeFilters.start && activeFilters.end ? "AND substr(ri.date, 1, 10) BETWEEN ? AND ?" : ""}
        ${activeFilters.locationId ? "AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?" : ""}
        ${activeFilters.itemId ? "AND CAST(ri.item_id AS INTEGER) = ?" : ""}
      GROUP BY UPPER(TRIM(ri.location_id))
      ORDER BY avgCostPerUnit DESC;
      `
    )
    .all(
      ...(activeFilters.start && activeFilters.end ? [activeFilters.start, activeFilters.end] : []),
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : [])
    );

  const consumptionTopItems = db
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
        CAST(ri.item_id AS INTEGER) AS itemId,
        ri.item_name AS item,
        COALESCE(SUM(COALESCE(ri.issues_qty, 0)), 0) AS qty
      FROM raw_inventory_v ri
      WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
        AND TRIM(COALESCE(ri.item_name, '')) <> ''
        ${activeFilters.start && activeFilters.end ? "AND substr(ri.date, 1, 10) BETWEEN ? AND ?" : ""}
        ${activeFilters.locationId ? "AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?" : ""}
        ${activeFilters.itemId ? "AND CAST(ri.item_id AS INTEGER) = ?" : ""}
      GROUP BY CAST(ri.item_id AS INTEGER), ri.item_name
      ORDER BY qty DESC, itemId ASC
      LIMIT 10;
      `
    )
    .all(
      ...(activeFilters.start && activeFilters.end ? [activeFilters.start, activeFilters.end] : []),
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : [])
    );

  const consumptionTopItemsByValue = db
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
        CAST(ri.item_id AS INTEGER) AS itemId,
        ri.item_name AS item,
        COALESCE(SUM(COALESCE(ri.inventory_value, 0)), 0) AS value
      FROM raw_inventory_v ri
      WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
        AND TRIM(COALESCE(ri.item_name, '')) <> ''
        ${activeFilters.start && activeFilters.end ? "AND substr(ri.date, 1, 10) BETWEEN ? AND ?" : ""}
        ${activeFilters.locationId ? "AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?" : ""}
        ${activeFilters.itemId ? "AND CAST(ri.item_id AS INTEGER) = ?" : ""}
      GROUP BY CAST(ri.item_id AS INTEGER), ri.item_name
      ORDER BY value DESC, itemId ASC
      LIMIT 10;
      `
    )
    .all(
      ...(activeFilters.start && activeFilters.end ? [activeFilters.start, activeFilters.end] : []),
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : [])
    );

  const referenceDate = activeFilters.end || "";
  const startDate = activeFilters.start || "";
  const startTs = `${startDate}T00:00:00`;
  const endTs = `${referenceDate}T23:59:59`;

  const expiredLots = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(ABS(e.quantity)), 0) AS expiredQty,
        COALESCE(SUM(ABS(e.quantity) * e.unit_cost_aed), 0) AS expiredValue
      FROM inventory_events e
      JOIN items i ON i.item_id = e.item_id
      WHERE e.event_type = 'ADJUSTMENT_WASTE'
      AND e.event_ts >= ? AND e.event_ts <= ?
      ${activeFilters.locationId ? "AND e.location_id = ?" : ""}
      ${activeFilters.itemId ? "AND e.item_id = ?" : ""};
      `
    )
    .get(
      startTs,
      endTs,
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : [])
    ) as { expiredQty: number; expiredValue: number };

  const expiringSoonParams: Array<string | number> = [referenceDate, referenceDate];
  if (activeFilters.locationId) expiringSoonParams.push(activeFilters.locationId);
  if (activeFilters.itemId) expiringSoonParams.push(activeFilters.itemId);

  const expiringSoon = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(l.qty_on_hand), 0) AS expiringSoonQty,
        COALESCE(SUM(l.qty_on_hand * i.unit_cost_aed), 0) AS expiringSoonValue
      FROM item_lots l
      JOIN items i ON i.item_id = l.item_id
      WHERE l.expiry_date >= ? AND l.expiry_date <= date(?, '+30 days')
      ${activeFilters.locationId ? "AND i.location_id = ?" : ""}
      ${activeFilters.itemId ? "AND i.item_id = ?" : ""};
      `
    )
    .get(...expiringSoonParams) as { expiringSoonQty: number; expiringSoonValue: number };

  const totalStockQty = db
    .prepare(
      `
      SELECT COALESCE(SUM(i.current_qty), 0) AS totalQty
      FROM items i
      ${itemWhere.sql};
      `
    )
    .get(...itemWhere.params) as { totalQty: number };

  const expiryByCategory = db
    .prepare(
      `
      SELECT c.category_name AS category,
        COALESCE(SUM(l.qty_on_hand), 0) AS qty
      FROM item_lots l
      JOIN items i ON i.item_id = l.item_id
      JOIN categories c ON c.category_id = i.category_id
      WHERE l.expiry_date >= ? AND l.expiry_date <= date(?, '+30 days')
      ${activeFilters.locationId ? "AND i.location_id = ?" : ""}
      ${activeFilters.itemId ? "AND i.item_id = ?" : ""}
      GROUP BY c.category_id
      ORDER BY qty DESC
      LIMIT 10;
      `
    )
    .all(...expiringSoonParams);

  const expiryTrendParams: Array<string | number> = [
    startDate,
    referenceDate,
    startDate,
    referenceDate,
  ];
  if (activeFilters.locationId) expiryTrendParams.push(activeFilters.locationId);
  if (activeFilters.itemId) expiryTrendParams.push(activeFilters.itemId);

  const expiryTrend = db
    .prepare(
      `
      WITH RECURSIVE dates(day) AS (
        SELECT ?
        UNION ALL
        SELECT date(day, '+1 day') FROM dates WHERE day < ?
      ),
      waste AS (
        SELECT
          substr(e.event_ts, 1, 10) AS day,
          COALESCE(SUM(ABS(e.quantity)), 0) AS qty
        FROM inventory_events e
        JOIN items i ON i.item_id = e.item_id
        WHERE e.event_type = 'ADJUSTMENT_WASTE'
          AND substr(e.event_ts, 1, 10) BETWEEN ? AND ?
          ${activeFilters.locationId ? "AND e.location_id = ?" : ""}
          ${activeFilters.itemId ? "AND e.item_id = ?" : ""}
        GROUP BY day
      )
      SELECT d.day AS day,
        COALESCE(w.qty, 0) AS qty
      FROM dates d
      LEFT JOIN waste w ON w.day = d.day
      ORDER BY d.day ASC;
      `
    )
    .all(...expiryTrendParams);

  const wasteFilterClauses = [
    "ri.dataset_id = (SELECT dataset_id FROM active_dataset)",
    "LOWER(TRIM(COALESCE(ri.event_type, ''))) = LOWER('Adjustment_waste')",
  ];
  const wasteFilterParams: Array<string | number> = [];
  if (activeFilters.start && activeFilters.end) {
    wasteFilterClauses.push("substr(ri.event_time_stamps, 1, 10) BETWEEN ? AND ?");
    wasteFilterParams.push(activeFilters.start, activeFilters.end);
  }
  if (activeFilters.locationId) {
    wasteFilterClauses.push("CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?");
    wasteFilterParams.push(activeFilters.locationId);
  }
  if (activeFilters.itemId) {
    wasteFilterClauses.push("CAST(ri.item_id AS INTEGER) = ?");
    wasteFilterParams.push(activeFilters.itemId);
  }

  const wasteByLocation = db
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
        UPPER(TRIM(COALESCE(ri.location_id, ''))) AS location_id,
        COALESCE(SUM(COALESCE(ri.quantity, 0)), 0) AS waste_quantity
      FROM raw_inventory_v ri
      WHERE ${wasteFilterClauses.join(" AND ")}
        AND TRIM(COALESCE(ri.location_id, '')) <> ''
      GROUP BY UPPER(TRIM(COALESCE(ri.location_id, '')))
      ORDER BY waste_quantity DESC;
      `
    )
    .all(...wasteFilterParams) as Array<{ location_id: string; waste_quantity: number }>;

  const wasteByItem = db
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
        CAST(ri.item_id AS INTEGER) AS item_id,
        ri.item_name AS item_name,
        COALESCE(SUM(COALESCE(ri.quantity, 0)), 0) AS waste_quantity
      FROM raw_inventory_v ri
      WHERE ${wasteFilterClauses.join(" AND ")}
      GROUP BY CAST(ri.item_id AS INTEGER), ri.item_name
      ORDER BY waste_quantity DESC, item_id ASC
      LIMIT 15;
      `
    )
    .all(...wasteFilterParams) as Array<{
    item_id: number;
    item_name: string | null;
    waste_quantity: number;
  }>;

  const wasteTrendOverTime = db
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
        substr(ri.event_time_stamps, 1, 10) AS event_date,
        COALESCE(SUM(COALESCE(ri.quantity, 0)), 0) AS waste_quantity
      FROM raw_inventory_v ri
      WHERE ${wasteFilterClauses.join(" AND ")}
        AND substr(ri.event_time_stamps, 1, 10) <> ''
      GROUP BY substr(ri.event_time_stamps, 1, 10)
      ORDER BY event_date ASC;
      `
    )
    .all(...wasteFilterParams) as Array<{ event_date: string; waste_quantity: number }>;

  const expiringSoonFilterClauses = [
    "ri.dataset_id = (SELECT dataset_id FROM active_dataset)",
    "date(substr(TRIM(ri.lot_expiry), 1, 10)) IS NOT NULL",
    "date(substr(TRIM(ri.lot_expiry), 1, 10)) >= date('now')",
    "date(substr(TRIM(ri.lot_expiry), 1, 10)) <= date('now', '+60 days')",
  ];
  const expiringSoonFilterParams: Array<string | number> = [];
  if (activeFilters.locationId) {
    expiringSoonFilterClauses.push("CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?");
    expiringSoonFilterParams.push(activeFilters.locationId);
  }
  if (activeFilters.itemId) {
    expiringSoonFilterClauses.push("CAST(ri.item_id AS INTEGER) = ?");
    expiringSoonFilterParams.push(activeFilters.itemId);
  }

  const expiringSoon60Days = db
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
        COUNT(1) AS lot_count
      FROM raw_inventory_v ri
      WHERE ${expiringSoonFilterClauses.join(" AND ")};
      `
    )
    .get(...expiringSoonFilterParams) as { lot_count: number };

  const minMaxCompliance = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          ri.item_name AS item_name,
          COALESCE(ri.closing_qty, 0) AS closing_qty,
          COALESCE(ri.min_qty, 0) AS min_qty,
          COALESCE(ri.max_qty, 0) AS max_qty,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${rawSnapshotWhere.sql}
      )
      SELECT
        COALESCE(SUM(CASE WHEN ls.closing_qty < ls.min_qty THEN 1 ELSE 0 END), 0) AS belowMin,
        COALESCE(SUM(CASE WHEN ls.closing_qty > ls.max_qty THEN 1 ELSE 0 END), 0) AS aboveMax,
        COALESCE(
          SUM(
            CASE
              WHEN ls.closing_qty < ls.min_qty THEN 0
              WHEN ls.closing_qty > ls.max_qty THEN 0
              ELSE 1
            END
          ),
          0
        ) AS withinRange
      FROM latest_snapshot ls
      WHERE ls.rn = 1;
      `
    )
    .get(...rawSnapshotWhere.params) as { belowMin: number; aboveMax: number; withinRange: number };

  const turnoverByItem = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          ri.item_name AS item_name,
          CAST(COALESCE(ri.issues_qty, 0) AS REAL) AS issues_qty,
          CAST(ri.current_stock_avg AS REAL) AS current_stock_avg,
          CAST(ri.current_stock_avg_rounded AS REAL) AS current_stock_avg_rounded,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${rawSnapshotWhere.sql}
      ),
      aggregated AS (
        SELECT
          ls.item_id AS itemId,
          COALESCE(NULLIF(TRIM(MAX(ls.item_name)), ''), 'Item ' || ls.item_id) AS itemName,
          SUM(COALESCE(ls.issues_qty, 0)) AS totalIssues,
          AVG(
            CASE
              WHEN ls.current_stock_avg IS NOT NULL THEN ls.current_stock_avg
              ELSE ls.current_stock_avg_rounded
            END
          ) AS avgStock
        FROM latest_snapshot ls
        WHERE ls.rn = 1
        GROUP BY ls.item_id
      )
      SELECT
        itemId,
        itemName,
        COALESCE(totalIssues, 0) AS totalIssues,
        COALESCE(avgStock, 0) AS avgStock,
        CASE
          WHEN avgStock IS NULL OR avgStock = 0 THEN 0
          ELSE totalIssues / avgStock
        END AS turnover
      FROM aggregated
      ORDER BY turnover DESC, itemId ASC;
      `
    )
    .all(...rawSnapshotWhere.params);

  const eventFeed = db
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
        UPPER(TRIM(COALESCE(ri.event_type, ''))) AS type,
        COALESCE(ri.quantity, 0) AS quantity,
        ri.event_time_stamps AS timestamp,
        CAST(ri.item_id AS INTEGER) AS itemId,
        UPPER(TRIM(ri.location_id)) AS location
      FROM raw_inventory_v ri
      WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
        ${activeFilters.start && activeFilters.end ? "AND substr(ri.event_time_stamps, 1, 10) BETWEEN ? AND ?" : ""}
        ${activeFilters.locationId ? "AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?" : ""}
        ${activeFilters.itemId ? "AND CAST(ri.item_id AS INTEGER) = ?" : ""}
        ${activeFilters.eventType ? "AND UPPER(TRIM(COALESCE(ri.event_type, ''))) = ?" : ""}
        ${activeFilters.eventLocation ? "AND UPPER(TRIM(ri.location_id)) = ?" : ""}
        ${activeFilters.eventItemId ? "AND CAST(ri.item_id AS INTEGER) = ?" : ""}
      ORDER BY datetime(ri.event_time_stamps) DESC, ri.rowid DESC
      ${activeFilters.eventFeedFull ? "" : "LIMIT 50"}
      `
    )
    .all(
      ...(activeFilters.start && activeFilters.end ? [activeFilters.start, activeFilters.end] : []),
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : []),
      ...(activeFilters.eventType ? [activeFilters.eventType] : []),
      ...(activeFilters.eventLocation ? [activeFilters.eventLocation] : []),
      ...(activeFilters.eventItemId ? [activeFilters.eventItemId] : [])
    );

  const topReorderRiskItems = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          ri.item_name AS item_name,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          COALESCE(ri.closing_qty, 0) AS closing_qty,
          COALESCE(ri.min_qty, 0) AS min_qty,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          ${activeFilters.locationId ? "AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?" : ""}
          ${
            activeFilters.itemId
              ? "AND CAST(ri.item_id AS INTEGER) = ?"
              : ""
          }
      )
      SELECT
        ls.item_id AS itemId,
        ls.item_name AS item,
        ls.location_id AS locationId,
        ls.closing_qty AS closingQty,
        ls.min_qty AS minQty,
        ROUND(ls.min_qty - ls.closing_qty, 0) AS gap
      FROM latest_snapshot ls
      WHERE ls.rn = 1
        AND ls.closing_qty <= ls.min_qty
      ORDER BY gap DESC, ls.closing_qty ASC
      LIMIT 10;
      `
    )
    .all(
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : [])
    );

  const topExpiryRiskLots = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      latest_snapshot AS (
        SELECT
          CAST(ri.item_id AS INTEGER) AS item_id,
          ri.item_name AS item_name,
          CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) AS location_id,
          ri.lot_number AS lot_number,
          ri.lot_expiry AS lot_expiry,
          COALESCE(ri.closing_qty, 0) AS closing_qty,
          COALESCE(ri.inventory_value, ri.closing_qty * COALESCE(ri.unit_cost_large_box, 0), 0) AS lot_value,
          ROW_NUMBER() OVER (
            PARTITION BY CAST(ri.item_id AS INTEGER), CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER)
            ORDER BY date(ri.date) DESC, datetime(ri.event_time_stamps) DESC, ri.rowid DESC
          ) AS rn
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.location_id, '')) <> ''
          AND TRIM(COALESCE(ri.lot_number, '')) <> ''
          AND TRIM(COALESCE(ri.lot_expiry, '')) <> ''
          ${activeFilters.locationId ? "AND CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = ?" : ""}
          ${
            activeFilters.itemId
              ? "AND CAST(ri.item_id AS INTEGER) = ?"
              : ""
          }
      ),
      parsed_expiry AS (
        SELECT
          ls.*,
          date(substr(TRIM(ls.lot_expiry), 1, 10)) AS expiry_date
        FROM latest_snapshot ls
      )
      SELECT
        pe.item_name AS item,
        pe.lot_number AS lotNumber,
        pe.expiry_date AS expiryDate,
        CASE
          WHEN pe.expiry_date IS NULL THEN NULL
          ELSE CAST(julianday(pe.expiry_date) - julianday(date('now')) AS INTEGER)
        END AS daysLeft,
        ROUND(pe.closing_qty, 0) AS qty,
        ROUND(pe.lot_value, 2) AS value,
        CASE
          WHEN pe.expiry_date IS NULL THEN '-'
          WHEN CAST(julianday(pe.expiry_date) - julianday(date('now')) AS INTEGER) <= 30 THEN 'High'
          WHEN CAST(julianday(pe.expiry_date) - julianday(date('now')) AS INTEGER) <= 60 THEN 'Medium'
          ELSE 'Low'
        END AS riskLevel,
        CASE
          WHEN pe.expiry_date IS NULL THEN '-'
          WHEN CAST(julianday(pe.expiry_date) - julianday(date('now')) AS INTEGER) < 0 THEN 'Expired - urgent handling'
          WHEN CAST(julianday(pe.expiry_date) - julianday(date('now')) AS INTEGER) <= 30 THEN 'Use immediately'
          WHEN CAST(julianday(pe.expiry_date) - julianday(date('now')) AS INTEGER) <= 60 THEN 'Monitor'
          ELSE 'OK'
        END AS action
      FROM parsed_expiry pe
      WHERE pe.rn = 1
      ORDER BY daysLeft ASC
      LIMIT 10;
      `
    )
    .all(
      ...(activeFilters.locationId ? [activeFilters.locationId] : []),
      ...(activeFilters.itemId ? [activeFilters.itemId] : [])
    );

  const turnover = null;

    return NextResponse.json({
      range: { start: activeFilters.start, end: activeFilters.end },
      inventorySummary,
      availability,
      reorderRisk,
      stockStatus,
      stockByLocation,
      totalCurrentQtyByLocation,
      stockStatusByItemLocation,
      stockAvailabilityScope,
      stockoutByCategory,
      reorderRiskByCategory,
      movementTotals,
      netMovement,
      movementByLocation,
      consumptionTotals,
      consumptionQtyByLocation,
      consumptionCostByLocation,
      consumptionTopItems,
      consumptionTopItemsByValue,
      expirySummary: {
        expiredQty: expiredLots.expiredQty,
        expiredValue: expiredLots.expiredValue,
        expiringSoonQty: expiringSoon.expiringSoonQty,
        expiringSoonValue: expiringSoon.expiringSoonValue,
      },
      totalStockQty: totalStockQty.totalQty,
      expiryByCategory,
      expiryTrend,
      wasteByLocation,
      wasteByItem,
      wasteTrendOverTime,
      expiringSoon60Days: expiringSoon60Days.lot_count,
      minMaxCompliance,
      turnoverByItem,
      turnover,
      eventFeed,
      topReorderRiskItems,
      topExpiryRiskLots,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Dashboard API error",
      },
      { status: 500 }
    );
  }
}
