import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getDbWrite } from "../../../../lib/db-write";

export const runtime = "nodejs";

type AbcCalcRow = {
  itemId: number;
  storageItemId: number;
  itemName: string;
  annualQty: number;
  annualConsumptionValue: number;
};

function getDaysInRange(periodStart: string, periodEnd: string) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

function computeAbcRows(rows: AbcCalcRow[]) {
  const withAnnual = rows.map((row) => {
    const annualQty = Number(row.annualQty ?? 0);
    const annualValueAed = Number(row.annualConsumptionValue ?? 0);
    return {
      itemId: row.itemId,
      storageItemId: row.storageItemId,
      itemName: row.itemName,
      annualQty,
      annualValueAed,
    };
  });

  const totalAnnualValue = withAnnual.reduce((sum, row) => sum + row.annualValueAed, 0);
  const sorted = [...withAnnual].sort((a, b) => b.annualValueAed - a.annualValueAed);

  let runningValue = 0;
  const lines = sorted.map((row) => {
    const valueSharePct = totalAnnualValue > 0 ? row.annualValueAed / totalAnnualValue : 0;
    runningValue += row.annualValueAed;
    const cumulativeSharePct = totalAnnualValue > 0 ? runningValue / totalAnnualValue : 0;
    const abcClass =
      cumulativeSharePct <= 0.8 ? "A" : cumulativeSharePct <= 0.95 ? "B" : "C";
    return {
      itemId: row.itemId,
      storageItemId: row.storageItemId,
      itemName: row.itemName,
      annualQty: Number(row.annualQty.toFixed(4)),
      annualValueAed: Number(row.annualValueAed.toFixed(4)),
      valueSharePct: Number(valueSharePct.toFixed(6)),
      cumulativeSharePct: Number(cumulativeSharePct.toFixed(6)),
      abcClass,
    };
  });

  return { totalAnnualValue, lines };
}

function fetchIssueRows(periodStart: string, periodEnd: string) {
  const db = getDb();
  return db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      item_name_map AS (
        SELECT
          LOWER(TRIM(ri.item_name)) AS itemNameKey,
          MIN(TRIM(ri.item_name)) AS itemName,
          MIN(CAST(ri.item_id AS INTEGER)) AS itemId
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.item_name, '')) <> ''
          AND TRIM(COALESCE(ri.item_id, '')) <> ''
        GROUP BY LOWER(TRIM(ri.item_name))
      ),
      storage_item_map AS (
        SELECT
          LOWER(TRIM(i.item_name)) AS itemNameKey,
          MIN(i.item_id) AS storageItemId
        FROM items i
        GROUP BY LOWER(TRIM(i.item_name))
      ),
      raw_agg AS (
        SELECT
          LOWER(TRIM(ri.item_name)) AS itemNameKey,
          COALESCE(SUM(COALESCE(ri.issues_qty, 0)), 0) AS annualQty,
          COALESCE(SUM(COALESCE(ri.annual_consumption_value, 0)), 0) AS annualConsumptionValue
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND date(ri.date) BETWEEN date(?) AND date(?)
          AND TRIM(COALESCE(ri.item_name, '')) <> ''
        GROUP BY LOWER(TRIM(ri.item_name))
      )
      SELECT
        inm.itemId AS itemId,
        sim.storageItemId AS storageItemId,
        inm.itemName AS itemName,
        COALESCE(ra.annualQty, 0) AS annualQty,
        COALESCE(ra.annualConsumptionValue, 0) AS annualConsumptionValue
      FROM item_name_map inm
      JOIN storage_item_map sim ON sim.itemNameKey = inm.itemNameKey
      LEFT JOIN raw_agg ra ON ra.itemNameKey = inm.itemNameKey
      ORDER BY inm.itemId ASC
      `
    )
    .all(periodStart, periodEnd) as AbcCalcRow[];
}

function readSnapshot(snapshotId: number) {
  const db = getDb();
  const snapshot = db
    .prepare(
      `
      SELECT
        snapshot_id AS snapshotId,
        snapshot_date AS snapshotDate,
        period_start AS periodStart,
        period_end AS periodEnd
      FROM abc_snapshots
      WHERE snapshot_id = ?
      `
    )
    .get(snapshotId);

  const groupedLines = db
    .prepare(
      `
      WITH active_dataset AS (
        SELECT dataset_id
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
      ),
      item_name_map AS (
        SELECT
          ri.item_name AS itemName,
          MIN(CAST(ri.item_id AS INTEGER)) AS itemId
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = (SELECT dataset_id FROM active_dataset)
          AND TRIM(COALESCE(ri.item_name, '')) <> ''
          AND TRIM(COALESCE(ri.item_id, '')) <> ''
        GROUP BY ri.item_name
      )
      SELECT
        COALESCE(m.itemId, l.item_id) AS itemId,
        COALESCE(m.itemName, i.item_name, CAST(l.item_id AS TEXT)) AS itemName,
        SUM(l.annual_qty) AS annualQty,
        SUM(l.annual_value_aed) AS annualValueAed
      FROM abc_snapshot_lines l
      LEFT JOIN items i ON i.item_id = l.item_id
      LEFT JOIN item_name_map m ON m.itemName = i.item_name
      WHERE l.snapshot_id = ?
      GROUP BY COALESCE(m.itemId, l.item_id), COALESCE(m.itemName, i.item_name, CAST(l.item_id AS TEXT))
      ORDER BY annualValueAed DESC, itemId ASC
      `
    )
    .all(snapshotId) as Array<{
    itemId: number;
    itemName: string;
    annualQty: number;
    annualValueAed: number;
  }>;

  const totalAnnualValue = groupedLines.reduce(
    (sum, row) => sum + Number(row.annualValueAed || 0),
    0
  );
  let runningValue = 0;
  const lines = groupedLines.map((row) => {
    const valueSharePct = totalAnnualValue > 0 ? Number(row.annualValueAed || 0) / totalAnnualValue : 0;
    runningValue += Number(row.annualValueAed || 0);
    const cumulativeSharePct = totalAnnualValue > 0 ? runningValue / totalAnnualValue : 0;
    const abcClass =
      cumulativeSharePct <= 0.8 ? "A" : cumulativeSharePct <= 0.95 ? "B" : "C";
    return {
      itemId: Number(row.itemId),
      itemName: row.itemName,
      annualQty: Number(Number(row.annualQty || 0).toFixed(4)),
      annualValueAed: Number(Number(row.annualValueAed || 0).toFixed(4)),
      valueSharePct: Number(valueSharePct.toFixed(6)),
      cumulativeSharePct: Number(cumulativeSharePct.toFixed(6)),
      abcClass,
    };
  });
  const classAValue = lines
    .filter((row) => row.abcClass === "A")
    .reduce((sum, row) => sum + Number(row.annualValueAed || 0), 0);

  return {
    snapshot,
    lines,
    kpis: {
      totalAnnualValue,
      totalItems: lines.length,
      classAValuePct: totalAnnualValue > 0 ? classAValue / totalAnnualValue : 0,
    },
  };
}

export function GET(request: NextRequest) {
  try {
    const snapshotId = request.nextUrl.searchParams.get("snapshotId");
    if (snapshotId) {
      return NextResponse.json(readSnapshot(Number(snapshotId)));
    }

    const db = getDb();
    const latest = db
      .prepare(
        `
        SELECT snapshot_id AS snapshotId
        FROM abc_snapshots
        ORDER BY snapshot_id DESC
        LIMIT 1
        `
      )
      .get() as { snapshotId: number } | undefined;

    if (!latest) {
      return NextResponse.json({
        snapshot: null,
        lines: [],
        kpis: { totalAnnualValue: 0, totalItems: 0, classAValuePct: 0 },
      });
    }

    return NextResponse.json(readSnapshot(latest.snapshotId));
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ABC API error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { periodStart?: string; periodEnd?: string };
    const periodStart = body.periodStart;
    const periodEnd = body.periodEnd;

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "periodStart and periodEnd are required" },
        { status: 400 }
      );
    }

    const daysInRange = getDaysInRange(periodStart, periodEnd);
    if (daysInRange <= 0) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const issueRows = fetchIssueRows(periodStart, periodEnd);
    const computed = computeAbcRows(issueRows);
    const dbWrite = getDbWrite();
    const today = new Date().toISOString().slice(0, 10);

    const tx = dbWrite.transaction(() => {
      const insertSnapshot = dbWrite.prepare(
        `
        INSERT INTO abc_snapshots (snapshot_date, period_start, period_end, notes)
        VALUES (?, ?, ?, ?)
        `
      );
      const result = insertSnapshot.run(today, periodStart, periodEnd, "Generated from ISSUE events");
      const snapshotId = Number(result.lastInsertRowid);

      const insertLine = dbWrite.prepare(
        `
        INSERT INTO abc_snapshot_lines
          (snapshot_id, item_id, annual_value_aed, annual_qty, value_share_pct, cumulative_share_pct, abc_class)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      );

      for (const line of computed.lines) {
        insertLine.run(
          snapshotId,
          line.storageItemId,
          line.annualValueAed,
          line.annualQty,
          line.valueSharePct,
          line.cumulativeSharePct,
          line.abcClass
        );
      }

      return snapshotId;
    });

    const snapshotId = tx();
    return NextResponse.json(readSnapshot(snapshotId));
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ABC snapshot generation error" },
      { status: 500 }
    );
  }
}

