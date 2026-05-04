import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

type ItemRow = {
  id: number;
  name: string;
};

type ActualRow = {
  date: string;
  actual: number;
};

type ForecastRow = {
  date: string;
  type: "prediction" | "forecast";
  demand: number;
};

type SummaryRow = {
  runId: string;
  datasetId: string;
  model: string;
  wape: number | null;
  r2: number | null;
  generatedAt: string;
};

type DateInfoRow = {
  rawDataEndDate: string | null;
  lastHistoricalMonth: string | null;
  forecastStartDate: string | null;
};

const FORECAST_ITEM_IDS = [100, 103, 105, 106, 107, 109] as const;
const ITEM_DATE_CUTOFF_SQL = `
  AND NOT (
    CAST(ri.item_id AS INTEGER) IN (100, 103)
    AND date(ri.date) >= date('2026-04-08')
  )
`;

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function GET(request: Request) {
  try {
    const db = getDb();
    const url = new URL(request.url);
    const requestedItemId = Number(url.searchParams.get("itemId") ?? "");

    const activeDataset = db
      .prepare(
        `
        SELECT dataset_id AS datasetId
        FROM datasets
        WHERE is_active = 1
        ORDER BY imported_at DESC
        LIMIT 1
        `
      )
      .get() as { datasetId: string } | undefined;

    if (!activeDataset?.datasetId) {
      return NextResponse.json({ error: "No active dataset found" }, { status: 404 });
    }

    const items = db
      .prepare(
        `
        SELECT
          CAST(ri.item_id AS INTEGER) AS id,
          TRIM(COALESCE(ri.item_name, '')) AS name
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = ?
          AND ri.item_id IS NOT NULL
          AND CAST(ri.item_id AS INTEGER) IN (${FORECAST_ITEM_IDS.map(() => "?").join(", ")})
          AND COALESCE(ri.issues_qty, 0) > 0
          ${ITEM_DATE_CUTOFF_SQL}
        GROUP BY CAST(ri.item_id AS INTEGER), TRIM(COALESCE(ri.item_name, ''))
        ORDER BY CAST(ri.item_id AS INTEGER) ASC
        `
      )
      .all(activeDataset.datasetId, ...FORECAST_ITEM_IDS) as ItemRow[];

    const firstItemId = items[0]?.id;
    const itemId = Number.isFinite(requestedItemId) && requestedItemId > 0 ? requestedItemId : firstItemId;

    if (!itemId) {
      return NextResponse.json({
        datasetId: activeDataset.datasetId,
        items,
        selectedItemId: null,
        latestRun: null,
        chartData: [],
      });
    }

    const latestRun = db
      .prepare(
        `
        SELECT fr.run_id AS runId
        FROM forecast_results fr
        WHERE fr.dataset_id = ?
          AND fr.item_id = ?
          AND fr.location_id = 0
        ORDER BY datetime(fr.created_at) DESC, fr.run_id DESC
        LIMIT 1
        `
      )
      .get(activeDataset.datasetId, itemId) as { runId: string } | undefined;

    const actualRows = db
      .prepare(
        `
        SELECT
          date(ri.date, 'start of month', '+1 month', '-1 day') AS date,
          COALESCE(SUM(ri.issues_qty), 0) AS actual
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = ?
          AND CAST(ri.item_id AS INTEGER) = ?
          AND ri.date IS NOT NULL
          AND COALESCE(ri.issues_qty, 0) > 0
          ${ITEM_DATE_CUTOFF_SQL}
        GROUP BY date(ri.date, 'start of month', '+1 month', '-1 day')
        HAVING COALESCE(SUM(ri.issues_qty), 0) > 0
        ORDER BY date(ri.date, 'start of month', '+1 month', '-1 day')
        `
      )
      .all(activeDataset.datasetId, itemId) as ActualRow[];

    const forecastRows = latestRun?.runId
      ? (db
          .prepare(
            `
            SELECT
              point_date AS date,
              point_type AS type,
              demand_qty AS demand
            FROM forecast_results
            WHERE dataset_id = ?
              AND run_id = ?
              AND item_id = ?
              AND location_id = 0
              AND point_type IN ('prediction', 'forecast')
            ORDER BY point_date ASC
            `
          )
          .all(activeDataset.datasetId, latestRun.runId, itemId) as ForecastRow[])
      : [];

    const dateInfo = db
      .prepare(
        `
        SELECT
          MAX(date(ri.date)) AS rawDataEndDate,
          MAX(date(ri.date, 'start of month', '+1 month', '-1 day')) AS lastHistoricalMonth
        FROM raw_inventory_v ri
        WHERE ri.dataset_id = ?
          AND CAST(ri.item_id AS INTEGER) = ?
          AND ri.date IS NOT NULL
          ${ITEM_DATE_CUTOFF_SQL}
        `
      )
      .get(activeDataset.datasetId, itemId) as Omit<DateInfoRow, "forecastStartDate">;

    const forecastStart = latestRun?.runId
      ? (db
          .prepare(
            `
            SELECT MIN(point_date) AS forecastStartDate
            FROM forecast_results
            WHERE dataset_id = ?
              AND run_id = ?
              AND item_id = ?
              AND location_id = 0
              AND point_type = 'forecast'
            `
          )
          .get(activeDataset.datasetId, latestRun.runId, itemId) as Pick<DateInfoRow, "forecastStartDate">)
      : { forecastStartDate: null };

    const summary = latestRun?.runId
      ? (db
          .prepare(
            `
            SELECT
              run_id AS runId,
              dataset_id AS datasetId,
              best_model_name AS model,
              wape,
              r2,
              MAX(created_at) AS generatedAt
            FROM forecast_results
            WHERE dataset_id = ?
              AND run_id = ?
              AND item_id = ?
              AND location_id = 0
            GROUP BY run_id, dataset_id, best_model_name, wape, r2
            LIMIT 1
            `
          )
          .get(activeDataset.datasetId, latestRun.runId, itemId) as SummaryRow | undefined)
      : undefined;

    const byDate = new Map<
      string,
      { date: string; actual: number | null; prediction: number | null; future: number | null }
    >();

    for (const row of actualRows) {
      byDate.set(row.date, {
        date: row.date,
        actual: toNumber(row.actual),
        prediction: null,
        future: null,
      });
    }

    for (const row of forecastRows) {
      const current =
        byDate.get(row.date) ??
        ({
          date: row.date,
          actual: null,
          prediction: null,
          future: null,
        } as { date: string; actual: number | null; prediction: number | null; future: number | null });

      if (row.type === "prediction") current.prediction = toNumber(row.demand);
      if (row.type === "forecast") current.future = toNumber(row.demand);
      byDate.set(row.date, current);
    }

    const chartData = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      datasetId: activeDataset.datasetId,
      items,
      selectedItemId: itemId,
      latestRun: summary ?? null,
      dateInfo: {
        rawDataEndDate: dateInfo.rawDataEndDate,
        lastHistoricalMonth: dateInfo.lastHistoricalMonth,
        forecastStartDate: forecastStart.forecastStartDate,
      },
      chartData,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Forecast API error" },
      { status: 500 }
    );
  }
}
