"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChatWidget from "./ChatWidget";

type FilterOption = { id: string | number; name: string };
type IngestorStatus = {
  connected: boolean;
  running?: boolean;
  last_sync_at?: string | null;
};

type FiltersResponse = {
  locations: FilterOption[];
  items: FilterOption[];
  dateRange: { minEnd: string | null; maxEnd: string | null };
};

type StockStatusBarData = {
  item_id: number;
  location_id: string;
  closing_qty: number;
  min_qty: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  date: string;
};

type DashboardResponse = {
  range: { start: string; end: string };
  inventorySummary: { items: number; locations: number; categories: number };
  availability: { availableItems: number };
  reorderRisk: { reorderRiskItems: number; totalRows: number };
  stockStatus: { inStock: number; lowStock: number; outStock: number };
  stockByLocation: Array<{
    locationId: number;
    location: string;
    totalItems: number;
    inStock: number;
    lowStock: number;
    outStock: number;
  }>;
  totalCurrentQtyByLocation: Array<{
    locationId: number;
    location: string;
    totalCurrentQty: number;
  }>;
  stockStatusByItemLocation: Array<{
    Item_ID: number;
    location_id: string;
    closing_qty: number;
    min_qty: number;
    Date: string;
    stock_status: "In Stock" | "Low Stock" | "Out of Stock";
    display_closing_qty: number;
  }>;
  stockAvailabilityScope: { totalItems: number };
  stockoutByCategory: Array<{ category: string; count: number }>;
  reorderRiskByCategory: Array<{
    category: string;
    count: number;
    totalRows: number;
    riskPercentage: number;
  }>;
  movementTotals: { receipts: number; issues: number };
  netMovement: number;
  movementByLocation: Array<{
    location: string;
    receipts: number;
    issues: number;
    netMovement: number;
  }>;
  consumptionTotals: { totalQty: number; totalCost: number };
  consumptionQtyByLocation: Array<{ date: string; locationId: string; qty: number }>;
  consumptionCostByLocation: Array<{
    location: string;
    totalValue: number;
    totalIssues: number;
    avgCostPerUnit: number;
  }>;
  consumptionTopItems: Array<{ itemId: number; item: string; qty: number }>;
  consumptionTopItemsByValue: Array<{ itemId: number; item: string; value: number }>;
  expirySummary: {
    expiredQty: number;
    expiredValue: number;
    expiringSoonQty: number;
    expiringSoonValue: number;
  };
  expiryByCategory: Array<{ category: string; qty: number }>;
  expiryTrend: Array<{ day: string; qty: number }>;
  wasteByLocation: Array<{ location_id: string; waste_quantity: number }>;
  wasteByItem: Array<{ item_id: number; item_name: string | null; waste_quantity: number }>;
  wasteTrendOverTime: Array<{ event_date: string; waste_quantity: number }>;
  expiringSoon60Days: number;
  minMaxCompliance: { belowMin: number; aboveMax: number; withinRange: number };
  turnover: number | null;
  turnoverByItem: Array<{
    itemId: number;
    itemName: string;
    totalIssues: number;
    avgStock: number;
    turnover: number;
  }>;
  eventFeed: Array<{
    type: string;
    quantity: number;
    timestamp: string | null;
    itemId: number;
    location: string;
  }>;
  totalStockQty: number;
  topReorderRiskItems: Array<{
    itemId: number;
    item: string;
    locationId: number;
    closingQty: number;
    minQty: number;
    gap: number;
  }>;
  topExpiryRiskLots: Array<{
    item: string;
    lotNumber: string;
    expiryDate: string;
    daysLeft: number | null;
    qty: number;
    value: number;
    riskLevel: string;
    action: string;
  }>;
};

const COLORS = {
  green: "#22c55e",
  yellow: "#F59E0B",
  red: "#ef4444",
  blue: "#2F6FED",
  purple: "#7C3AED",
  cyan: "#2F6FED",
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const formatInteger = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

export default function Dashboard() {
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    locationId: "",
    itemId: "",
  });
  const [options, setOptions] = useState<FiltersResponse | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [eventLocationFilter, setEventLocationFilter] = useState<string>("all");
  const [eventItemIdFilter, setEventItemIdFilter] = useState<string>("all");
  const [eventDownloadOpen, setEventDownloadOpen] = useState(false);
  const [exportingEventFeed, setExportingEventFeed] = useState<"excel" | "pdf" | null>(null);
  const [ingestorStatus, setIngestorStatus] = useState<IngestorStatus | null>(null);
  const eventDownloadRef = useRef<HTMLDivElement | null>(null);

  const hasDateFilterApplied = useMemo(() => {
    if (!options?.dateRange.minEnd || !options?.dateRange.maxEnd) return false;
    return filters.start !== options.dateRange.minEnd || filters.end !== options.dateRange.maxEnd;
  }, [filters.end, filters.start, options?.dateRange.maxEnd, options?.dateRange.minEnd]);

  const hasAnyEventFeedFilterApplied = useMemo(() => {
    return (
      hasDateFilterApplied
      || Boolean(filters.locationId)
      || Boolean(filters.itemId)
      || eventTypeFilter !== "all"
      || eventLocationFilter !== "all"
      || eventItemIdFilter !== "all"
    );
  }, [
    eventItemIdFilter,
    eventLocationFilter,
    eventTypeFilter,
    filters.itemId,
    filters.locationId,
    hasDateFilterApplied,
  ]);

  useEffect(() => {
    let active = true;
    fetch("/api/filters")
      .then((res) => res.json())
      .then((payload: FiltersResponse) => {
        if (!active) return;
        setOptions(payload);
        if (payload.dateRange.minEnd && payload.dateRange.maxEnd) {
          setFilters((prev) => ({
            ...prev,
            start: payload.dateRange.minEnd ?? "",
            end: payload.dateRange.maxEnd ?? "",
          }));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!eventDownloadOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (eventDownloadRef.current && !eventDownloadRef.current.contains(target)) {
        setEventDownloadOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [eventDownloadOpen]);

  useEffect(() => {
    if (!filters.start || !filters.end) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("start", filters.start);
    params.set("end", filters.end);
    if (filters.locationId) params.set("locationId", filters.locationId);
    if (filters.itemId) params.set("itemId", filters.itemId);
    if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
    if (eventLocationFilter !== "all") params.set("eventLocation", eventLocationFilter);
    if (eventItemIdFilter !== "all") params.set("eventItemId", eventItemIdFilter);
    if (hasAnyEventFeedFilterApplied) params.set("eventFeedFull", "1");
    fetch(`/api/dashboard?${params.toString()}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok || !payload?.inventorySummary) {
          throw new Error(
            typeof payload?.error === "string" ? payload.error : "Failed to load dashboard data"
          );
        }
        return payload as DashboardResponse;
      })
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [filters, eventTypeFilter, eventLocationFilter, eventItemIdFilter, hasAnyEventFeedFilterApplied]);

  useEffect(() => {
    let active = true;
    const loadStatus = () => {
      fetch("/api/ingestor/status")
        .then((res) => res.json())
        .then((payload: IngestorStatus) => {
          if (!active) return;
          setIngestorStatus(payload);
        })
        .catch(() => {
          if (!active) return;
          setIngestorStatus({ connected: false });
        });
    };
    loadStatus();
    const timer = setInterval(loadStatus, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const availabilityPercent = useMemo(() => {
    if (!data) return 0;
    const total = data.inventorySummary.items;
    if (!total) return 0;
    return Math.round((data.availability.availableItems / total) * 100);
  }, [data]);

  const reorderRiskItems = useMemo(() => {
    if (!data) return 0;
    return data.reorderRisk.reorderRiskItems;
  }, [data]);

  const reorderRiskScopeTotal = useMemo(() => {
    if (!data) return 0;
    return data.reorderRisk.totalRows;
  }, [data]);

  const reorderRiskPercent = useMemo(() => {
    if (!data) return 0;
    if (!reorderRiskScopeTotal) return 0;
    return Math.round((reorderRiskItems / reorderRiskScopeTotal) * 100);
  }, [data, reorderRiskItems, reorderRiskScopeTotal]);

  const availabilityStatus =
    availabilityPercent >= 95 ? "text-emerald-700" : "text-red-700";

  const minMaxTotal = useMemo(() => {
    if (!data) return 0;
    return (
      data.minMaxCompliance.belowMin +
      data.minMaxCompliance.withinRange +
      data.minMaxCompliance.aboveMax
    );
  }, [data]);

  const eventLocations = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.eventFeed.map((event) => event.location)));
  }, [data]);

  const eventItemIds = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.eventFeed.map((event) => String(event.itemId)))).sort(
      (a, b) => Number(a) - Number(b)
    );
  }, [data]);

  const eventItemNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of options?.items ?? []) {
      const id = String(item.id ?? "").trim();
      const name = String(item.name ?? "").trim();
      if (!id || !name) continue;
      map.set(id, name);
    }
    return map;
  }, [options?.items]);

  const eventTypes = ["RECEIPT", "ISSUE", "ADJUSTMENT_WASTE"];
  const eventTypeColor: Record<string, string> = {
    RECEIPT: "text-emerald-700",
    ISSUE: "text-amber-700",
    ADJUSTMENT_WASTE: "text-red-700",
  };

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    return data.eventFeed;
  }, [data]);

  const eventFeedExportRows = useMemo(
    () =>
      filteredEvents.map((event) => ({
        Type: String(event.type ?? ""),
        "Item ID": String(event.itemId ?? ""),
        Location: String(event.location ?? ""),
        Quantity: formatNumber(Math.abs(Number(event.quantity ?? 0))),
        Timestamp: String(event.timestamp ?? ""),
      })),
    [filteredEvents]
  );

  const exportEventFeedExcel = useCallback(async () => {
    if (!eventFeedExportRows.length) return;
    setExportingEventFeed("excel");
    try {
      const { utils, writeFile } = await import("xlsx");
      const sheet = utils.json_to_sheet(eventFeedExportRows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, sheet, "Event Feed");
      const name = `event_feed_${filters.start || "start"}_${filters.end || "end"}.xlsx`;
      writeFile(wb, name);
    } finally {
      setExportingEventFeed(null);
    }
  }, [eventFeedExportRows, filters.end, filters.start]);

  const exportEventFeedPdf = useCallback(async () => {
    if (!eventFeedExportRows.length) return;
    setExportingEventFeed("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      type AutoTableFn = (doc: unknown, options: Record<string, unknown>) => void;
      const autoTableDefault = (autoTableModule as unknown as { default?: AutoTableFn }).default;
      const autoTable = (autoTableDefault ?? (autoTableModule as unknown as AutoTableFn)) as AutoTableFn;

      doc.setFontSize(12);
      doc.text("Movement & Event Feed", 40, 40);
      doc.setFontSize(9);
      doc.text(
        `Range: ${filters.start || "-"} to ${filters.end || "-"} | Type: ${eventTypeFilter} | Location: ${eventLocationFilter} | Item ID: ${eventItemIdFilter}`,
        40,
        58
      );

      autoTable(doc, {
        head: [["Type", "Item ID", "Location", "Quantity", "Timestamp"]],
        body: eventFeedExportRows.map((r) => [
          r.Type,
          r["Item ID"],
          r.Location,
          r.Quantity,
          r.Timestamp,
        ]),
        startY: 75,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [91, 102, 114] },
        margin: { left: 40, right: 40 },
        theme: "striped",
      });

      const name = `event_feed_${filters.start || "start"}_${filters.end || "end"}.pdf`;
      doc.save(name);
    } finally {
      setExportingEventFeed(null);
    }
  }, [
    eventFeedExportRows,
    eventItemIdFilter,
    eventLocationFilter,
    eventTypeFilter,
    filters.end,
    filters.start,
  ]);

  const wasteByItemChartData = useMemo(() => {
    if (!data) return [];
    return data.wasteByItem.map((row) => ({
      ...row,
      item_label: row.item_name?.trim() ? row.item_name : `Item ${row.item_id}`,
    }));
  }, [data]);

  const breakdownTotals = useMemo(() => {
    if (!data)
      return {
        total: 0,
        rows: [] as Array<{
          category: string;
          count: number;
          totalRows: number;
          riskPercentage: number;
        }>,
      };
    return { total: data.stockAvailabilityScope.totalItems, rows: data.reorderRiskByCategory };
  }, [data]);

  const breakdownData = useMemo(() => {
    if (!breakdownTotals.total) return [];
    return breakdownTotals.rows.map((row) => ({
      ...row,
      percent: Math.round(row.riskPercentage),
    }));
  }, [breakdownTotals]);

  const demandTrendLocations = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.consumptionQtyByLocation.map((row) => row.locationId))).sort();
  }, [data]);

  const demandTrendData = useMemo(() => {
    if (!data) return [] as Array<Record<string, string | number>>;
    const byDate = new Map<string, Record<string, string | number>>();
    for (const row of data.consumptionQtyByLocation) {
      const existing = byDate.get(row.date) ?? { date: row.date };
      existing[row.locationId] = Number(row.qty ?? 0);
      byDate.set(row.date, existing);
    }
    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [data]);

  const demandTrendMonthlyTicks = useMemo(() => {
    if (!demandTrendData.length) return [] as string[];
    const monthStarts: string[] = [];
    let lastMonth = "";
    for (const row of demandTrendData) {
      const day = String(row.date ?? "").slice(0, 10);
      const monthKey = day.slice(0, 7);
      if (monthKey && monthKey !== lastMonth) {
        monthStarts.push(day);
        lastMonth = monthKey;
      }
    }
    if (monthStarts.length <= 10) return monthStarts;
    const step = Math.ceil(monthStarts.length / 10);
    return monthStarts.filter((_, idx) => idx % step === 0);
  }, [demandTrendData]);

  const stockStatusByItemLocationBaseRows = useMemo(() => {
    if (!data) return [];
    return [...data.stockStatusByItemLocation].sort((a, b) => {
      if (a.Item_ID !== b.Item_ID) return a.Item_ID - b.Item_ID;
      return String(a.location_id).localeCompare(String(b.location_id));
    });
  }, [data]);

  const stockStatusByItemLocationSingleItemView = useMemo(() => {
    const uniqueItemIds = new Set(stockStatusByItemLocationBaseRows.map((row) => row.Item_ID));
    return uniqueItemIds.size <= 1;
  }, [stockStatusByItemLocationBaseRows]);

  const stockStatusByItemLocationChartData = useMemo(() => {
    const rows = stockStatusByItemLocationBaseRows;
    if (!rows.length) return [];
    const grouped = new Map<number, typeof rows>();
    for (const row of rows) {
      const existing = grouped.get(row.Item_ID) ?? [];
      existing.push(row);
      grouped.set(row.Item_ID, existing);
    }

    const chartRows: Array<
      (typeof rows)[number] & {
        x_key: string;
        item_group_label: string;
        location_label: string;
        isSpacer: boolean;
        chart_value: number | null;
        bar_data: StockStatusBarData | null;
      }
    > = [];

    const groups = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
    groups.forEach(([itemId, groupRows], groupIdx) => {
      const middleIdx = Math.floor((groupRows.length - 1) / 2);
      groupRows.forEach((row, rowIdx) => {
        chartRows.push({
          ...row,
          x_key: `${itemId}-${row.location_id}-${rowIdx}`,
          item_group_label: rowIdx === middleIdx ? String(itemId) : "",
          location_label: row.location_id,
          isSpacer: false,
          chart_value: row.display_closing_qty,
          bar_data: {
            item_id: row.Item_ID,
            location_id: row.location_id,
            closing_qty: row.closing_qty,
            min_qty: row.min_qty,
            status: row.stock_status,
            date: row.Date,
          },
        });
      });

      if (!stockStatusByItemLocationSingleItemView && groupIdx < groups.length - 1) {
        chartRows.push({
          ...groupRows[groupRows.length - 1],
          x_key: `spacer-${itemId}-${groupIdx}`,
          item_group_label: "",
          location_label: "",
          isSpacer: true,
          chart_value: null,
          bar_data: null,
        });
      }
    });

    return chartRows;
  }, [stockStatusByItemLocationBaseRows, stockStatusByItemLocationSingleItemView]);

  const stockStatusByItemLocationChartWidth = useMemo(() => {
    const pointCount = stockStatusByItemLocationChartData.length;
    return Math.max(720, pointCount * 34);
  }, [stockStatusByItemLocationChartData]);

  const stockStatusByItemLocationNeedsScroll = useMemo(() => {
    return stockStatusByItemLocationChartData.length > 12;
  }, [stockStatusByItemLocationChartData]);

  const stockStatusByItemLocationLookup = useMemo(() => {
    const map = new Map<string, (typeof stockStatusByItemLocationChartData)[number]>();
    for (const row of stockStatusByItemLocationChartData) {
      map.set(row.x_key, row);
    }
    return map;
  }, [stockStatusByItemLocationChartData]);

  const stockStatusByItemLocationSingleModeData = useMemo(() => {
    if (!stockStatusByItemLocationSingleItemView) return [];
    return stockStatusByItemLocationBaseRows.map((row, idx) => ({
      ...row,
      x_key: `single-${row.location_id}-${idx}`,
      location_label: row.location_id,
      bar_data: {
        item_id: row.Item_ID,
        location_id: row.location_id,
        closing_qty: row.closing_qty,
        min_qty: row.min_qty,
        status: row.stock_status,
        date: row.Date,
      },
      in_stock_value: row.stock_status === "In Stock" ? Number(row.display_closing_qty ?? 0) : 0,
      low_stock_value: row.stock_status === "Low Stock" ? Number(row.display_closing_qty ?? 0) : 0,
      out_stock_value: row.stock_status === "Out of Stock" ? Number(row.display_closing_qty ?? 0) : 0,
    }));
  }, [stockStatusByItemLocationBaseRows, stockStatusByItemLocationSingleItemView]);

  const stockStatusLegendPayload = useMemo(
    () => [
      { value: "In Stock", type: "square" as const, color: COLORS.green },
      { value: "Low Stock", type: "square" as const, color: COLORS.yellow },
      { value: "Out of Stock", type: "square" as const, color: COLORS.red },
    ],
    []
  );

  const stockStatusChartCells = useMemo(
    () =>
      stockStatusByItemLocationChartData.map((row, idx) => (
        <Cell
          key={`${row.Item_ID}-${row.location_id}-${idx}`}
          fill={
            row.isSpacer
              ? "transparent"
              : row.stock_status === "In Stock"
                ? COLORS.green
                : row.stock_status === "Low Stock"
                  ? COLORS.yellow
                  : COLORS.red
          }
        />
      )),
    [stockStatusByItemLocationChartData]
  );

  const renderStockStatusTick = useCallback(
    (props: unknown) => {
      const p = props as { x?: string | number; y?: string | number; payload?: { value?: string | number } } | null;
      const key = String(p?.payload?.value ?? "");
      const row = stockStatusByItemLocationLookup.get(key);
      if (!row || row.isSpacer) return <g />;
      return (
        <g transform={`translate(${Number(p?.x ?? 0)},${Number(p?.y ?? 0)})`}>
          <text x={0} y={0} dy={8} textAnchor="middle" fill="#5B6672" fontSize={9}>
            {row.location_label}
          </text>
          <text x={0} y={0} dy={30} textAnchor="middle" fill="#5B6672" fontSize={9}>
            {row.item_group_label}
          </text>
        </g>
      );
    },
    [stockStatusByItemLocationLookup]
  );

  const renderSingleStockTick = useCallback((props: unknown) => {
    const p = props as { x?: string | number; y?: string | number; payload?: { value?: string | number } } | null;
    const value = String(p?.payload?.value ?? "");
    if (!value) return <g />;
    return (
      <g transform={`translate(${Number(p?.x ?? 0)},${Number(p?.y ?? 0)})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="#5B6672" fontSize={10}>
          {value}
        </text>
      </g>
    );
  }, []);

  const renderStockStatusTooltip = useCallback(
    (props: unknown) => {
      const p = props as { active?: boolean; payload?: ReadonlyArray<{ payload?: { bar_data?: StockStatusBarData | null } }> } | null;
      if (!p?.active || !p?.payload?.length) return null;
      const info = p.payload[0]?.payload?.bar_data as StockStatusBarData | null | undefined;
      if (!info) return null;
      return (
        <div className="rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white shadow">
          <div className="font-semibold">
            Item {info.item_id} - {info.location_id}
          </div>
          <div>Date: {info.date || "N/A"}</div>
          <div>closing_qty: {formatInteger(Number(info.closing_qty ?? 0))}</div>
          <div>min_qty: {formatInteger(Number(info.min_qty ?? 0))}</div>
          <div>Status: {info.status}</div>
        </div>
      );
    },
    []
  );

  const formatMonthYearTick = (value: string | number) => {
    const raw = String(value ?? "").slice(0, 10);
    const parts = raw.split("-");
    const year = parts[0];
    const month = Number(parts[1]);
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    if (!year || !Number.isFinite(month) || month < 1 || month > 12) return raw;
    return `${monthNames[month - 1]} ${year}`;
  };

  const handleLocationDrill = (payload: { locationId?: number }) => {
    if (!payload?.locationId) return;
    setFilters((prev) => ({ ...prev, locationId: String(payload.locationId) }));
  };

  if (!data || !options) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dashboard">
        <div className="text-[color:var(--text-muted)]">Loading dashboard...</div>
      </div>
    );
  }

  const movementData = [
    { name: "Receipts", value: data.movementTotals.receipts, color: COLORS.green },
    { name: "Issues", value: data.movementTotals.issues, color: COLORS.red },
  ];

  const shortLocationLabel = (name: string) => {
    const normalized = name.toLowerCase();
    if (normalized.includes("main")) return "Main Warehouse";
    if (normalized.includes("emergency")) return "ER Store";
    if (normalized.includes("icu")) return "ICU Store";
    if (normalized.includes("operating")) return "OR Store";
    return name;
  };

  const minMaxData = [
    { name: "Below Min", value: data.minMaxCompliance.belowMin, color: COLORS.red },
    { name: "Within Range", value: data.minMaxCompliance.withinRange, color: COLORS.green },
    { name: "Above Max", value: data.minMaxCompliance.aboveMax, color: COLORS.yellow },
  ];

  const minMaxWithPercent = minMaxData.map((entry) => ({
    ...entry,
    percent: minMaxTotal ? Math.round((entry.value / minMaxTotal) * 100) : 0,
  }));

  const reorderStatusMeta = (closingQty: number, minQty: number, gap: number) => {
    if (closingQty > minQty || gap < 0) {
      return {
        label: "Safe",
        className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      };
    }
    if (closingQty === minQty || gap === 0) {
      return {
        label: "At Threshold",
        className: "bg-amber-100 text-amber-700 border border-amber-200",
      };
    }
    return {
      label: "Shortage",
      className: "bg-rose-100 text-rose-700 border border-rose-200",
    };
  };

  const expiryRiskBadgeClass = (riskLevel: string) => {
    if (riskLevel === "High") return "bg-rose-100 text-rose-700 border border-rose-200";
    if (riskLevel === "Medium") return "bg-amber-100 text-amber-700 border border-amber-200";
    if (riskLevel === "Low") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    return "bg-slate-100 text-slate-600 border border-slate-200";
  };

  return (
    <div className="min-h-screen bg-dashboard text-[color:var(--text-main)]">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-6 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-wide">
              Inventory Manager Dashboard
            </h1>
            <p className="text-sm text-[color:var(--text-muted)]">
              Real-time inventory visibility, movement, and expiry insights
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full bg-[var(--surface-bg)] px-4 py-2 text-sm">
            <span className="text-[color:var(--text-muted)]">
              Availability
              <span
                className="ml-1 cursor-help text-[color:var(--text-muted)]"
                title="Availability % = (Items In Stock / Total Items) * 100"
              >
                ⓘ
              </span>
              :
            </span>
            <span
              className={`rounded-full bg-[var(--card-bg)] px-3 py-1 text-sm font-semibold ${availabilityStatus}`}
            >
              {availabilityPercent}%
            </span>
            <span className="text-[color:var(--text-muted)]">Target:</span>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700">
              95%
            </span>
          </div>
        </div>
        <div className="text-xs text-[color:var(--text-muted)]">
          Ingestor:{" "}
          {ingestorStatus?.connected
            ? `${ingestorStatus.running ? "running" : "connected"}${ingestorStatus.last_sync_at ? ` | last sync: ${new Date(ingestorStatus.last_sync_at).toLocaleString()}` : ""}`
            : "offline"}
        </div>

        <div className="grid gap-4 rounded-2xl bg-[var(--card-bg)] p-4 md:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
              Start Date
            </label>
            <input
              type="date"
              value={filters.start}
              onChange={(e) => setFilters((prev) => ({ ...prev, start: e.target.value }))}
              className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm text-[color:var(--text-main)] outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
              End Date
            </label>
            <input
              type="date"
              value={filters.end}
              onChange={(e) => setFilters((prev) => ({ ...prev, end: e.target.value }))}
              className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm text-[color:var(--text-main)] outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
              Location
            </label>
            <select
              value={filters.locationId}
              onChange={(e) => setFilters((prev) => ({ ...prev, locationId: e.target.value }))}
              className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm text-[color:var(--text-main)] outline-none"
            >
              <option value="">All Locations</option>
              {options.locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
              Item
            </label>
            <select
              value={filters.itemId}
              onChange={(e) => setFilters((prev) => ({ ...prev, itemId: e.target.value }))}
              className="rounded-lg bg-[var(--surface-bg)] px-3 py-2 text-sm text-[color:var(--text-main)] outline-none"
            >
              <option value="">All Items</option>
              {options.items.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.id} - {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 pb-16">
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-white/70">Item-Location Pairs</p>
            <p className="mt-2 text-2xl font-semibold">
              {formatNumber(data.inventorySummary.items)}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-white/70">Locations</p>
            <p className="mt-2 text-2xl font-semibold">
              {formatNumber(data.inventorySummary.locations)}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-white/70">Items</p>
            <p className="mt-2 text-2xl font-semibold">
              {formatNumber(data.inventorySummary.categories)}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--card-bg)] p-4 text-center shadow-card">
            <p className="text-xs text-white/70">
              Reorder Risk Items
              <span
                className="ml-1 cursor-help text-white/50"
                title="Reorder Risk = items where current_qty < min_qty"
              >
                ⓘ
              </span>
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatNumber(reorderRiskItems)}
            </p>
            <p className="text-xs text-white/60">
              {reorderRiskScopeTotal > 0 ? `${reorderRiskPercent}% of items` : "No items"}
            </p>
          </div>
        </section>

        {data.inventorySummary.items === 0 && (
          <section className="rounded-2xl bg-white/10 p-6 text-center shadow-card">
            <p className="text-sm text-white/70">No data for selected filters.</p>
          </section>
        )}

        <section className="rounded-2xl bg-[var(--card-bg)] p-5 shadow-card border border-[color:var(--border-color)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              STOCK AVAILABILITY ACROSS MULTIPLE LOCATIONS
            </h2>
            {loading && <span className="text-xs text-white/60">Refreshing...</span>}
          </div>
          <div className="grid items-stretch gap-5">
            <div className="rounded-2xl bg-white/10 p-4 h-96 min-w-0 overflow-hidden flex flex-col">
              <p className="text-center text-xs text-white/60">
                Stock Status by Item and Location
              </p>
              <p className="text-center text-[11px] text-white/50">
                Latest Date by Item_ID + location_id, bar height = closing_qty
              </p>
              <div
                className="mt-2 flex-1 w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable]"
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    minWidth:
                      stockStatusByItemLocationNeedsScroll && !stockStatusByItemLocationSingleItemView
                        ? `${stockStatusByItemLocationChartWidth}px`
                        : undefined,
                    height: "100%",
                    margin: "0 auto",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%" debounce={120}>
                    <BarChart
                      data={
                        stockStatusByItemLocationSingleItemView
                          ? stockStatusByItemLocationSingleModeData
                          : stockStatusByItemLocationChartData
                      }
                      barCategoryGap={38}
                      barGap={4}
                      margin={{ top: 8, right: 4, left: 4, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                      <XAxis
                        dataKey={
                          stockStatusByItemLocationSingleItemView ? "location_label" : "x_key"
                        }
                        interval={0}
                        minTickGap={12}
                        height={92}
                        label={{
                          value: "Item ID and Location",
                          position: "insideBottom",
                          fill: "#5B6672",
                          fontSize: 10,
                          dy: 12,
                        }}
                        tick={
                          stockStatusByItemLocationSingleItemView
                            ? renderSingleStockTick
                            : renderStockStatusTick
                        }
                      />
                      <YAxis
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        allowDecimals={false}
                        tickFormatter={(value) => formatInteger(Number(value))}
                        label={{
                          value: "Quantity",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#5B6672",
                          fontSize: 10,
                        }}
                      />
                      <Tooltip content={renderStockStatusTooltip} isAnimationActive={false} />
                      <Legend
                        align="right"
                        verticalAlign="top"
                        wrapperStyle={{ fontSize: 11 }}
                        content={() => (
                          <div className="flex flex-wrap justify-end gap-3 text-[11px] text-[#5B6672]">
                            {stockStatusLegendPayload.map((entry) => (
                              <div key={entry.value} className="flex items-center gap-1.5">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-sm"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span>{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      />
                      {stockStatusByItemLocationSingleItemView ? (
                        <>
                          <Bar
                            dataKey="in_stock_value"
                            name="In Stock"
                            fill={COLORS.green}
                            legendType="none"
                            maxBarSize={18}
                            isAnimationActive={false}
                          />
                          <Bar
                            dataKey="low_stock_value"
                            name="Low Stock"
                            fill={COLORS.yellow}
                            legendType="none"
                            maxBarSize={18}
                            isAnimationActive={false}
                          />
                          <Bar
                            dataKey="out_stock_value"
                            name="Out of Stock"
                            fill={COLORS.red}
                            legendType="none"
                            maxBarSize={18}
                            isAnimationActive={false}
                          />
                        </>
                      ) : (
                        <Bar
                          dataKey="chart_value"
                          name=""
                          legendType="none"
                          maxBarSize={18}
                          isAnimationActive={false}
                        >
                          {stockStatusChartCells}
                        </Bar>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--card-bg)] p-5 shadow-card border border-[color:var(--border-color)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Min/Max Compliance & Reorder Risk
            </h2>
            <div className="text-xs text-white/70">
              Based on min/max policies
              <span
                className="ml-1 cursor-help text-white/50"
                title="Below Min: current_qty < min_qty. Within Range: min_qty ≤ current_qty ≤ max_qty. Above Max: current_qty > max_qty."
              >
                ⓘ
              </span>
            </div>
          </div>
          <div className="grid items-stretch gap-6 lg:grid-cols-[0.9fr_1.3fr]">
            <div className="rounded-2xl bg-white/10 p-5 h-full flex flex-col">
              <p className="text-center text-xs text-white/60">Policy Compliance</p>
              <p className="text-center text-[11px] text-white/50">
                Based on current stock vs min/max thresholds
              </p>
              <div className="mt-3 h-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={minMaxData} innerRadius={50} outerRadius={74} dataKey="value">
                      {minMaxData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => {
                        const value = Number(v);
                        const percent = minMaxTotal ? Math.round((value / minMaxTotal) * 100) : 0;
                        return [`${formatNumber(value)} (${percent}%)`, name];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-6 text-center text-xs text-white/70">
                <div>
                  <div className="text-[11px] text-white/50 whitespace-nowrap">Within Range (%)</div>
                  <div className="font-semibold text-emerald-700">
                    {minMaxTotal
                      ? `${Math.round((data.minMaxCompliance.withinRange / minMaxTotal) * 100)}%`
                      : "0%"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-white/50 whitespace-nowrap">Below Min (Count)</div>
                  <div className="font-semibold">{formatInteger(data.minMaxCompliance.belowMin)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/50 whitespace-nowrap">Above Max (Count)</div>
                  <div className="font-semibold">{formatInteger(data.minMaxCompliance.aboveMax)}</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-5 h-full flex flex-col">
              <p className="text-center text-xs text-white/60">Inventory Turnover by Item</p>
              <p className="mt-3 mb-4 text-center text-[10px] text-white/50">
                Turnover calculated as SUM(issues_qty) divided by AVG(current_stock_avg) per item.
              </p>
              {data.turnoverByItem.length === 0 ? (
                <p className="mt-6 text-center text-sm text-white/60">
                  No turnover data for selected filters.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.turnoverByItem}
                      margin={{ left: 52, right: 52, top: 2, bottom: 10 }}
                      barCategoryGap="18%"
                      barSize={18}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                      <XAxis
                        dataKey="itemId"
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        interval={0}
                        tickMargin={10}
                        height={62}
                        label={{
                          value: "Item Number",
                          position: "insideBottom",
                          offset: -2,
                          fill: "#5B6672",
                          fontSize: 10,
                          fontWeight: 500,
                        }}
                      />
                      <YAxis
                        width={78}
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        tickFormatter={(value) => formatNumber(Number(value))}
                        tickCount={6}
                        label={{
                          value: "Turnover",
                          angle: -90,
                          position: "insideLeft",
                          dx: -8,
                          fill: "#5B6672",
                          fontSize: 10,
                          fontWeight: 500,
                        }}
                      />
                      <Tooltip
                        labelFormatter={(_label, payload) => {
                          const info = payload?.[0]?.payload as
                            | {
                                itemName?: string;
                                itemId?: number;
                              }
                            | undefined;
                          const itemName = info?.itemName ?? "N/A";
                          const itemId = info?.itemId ?? "N/A";
                          return `${itemName} (ID: ${itemId})`;
                        }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const info = payload[0]?.payload as
                            | {
                                itemName?: string;
                                turnover?: number;
                                totalIssues?: number;
                                avgStock?: number;
                              }
                            | undefined;
                          return (
                            <div className="rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white shadow">
                              <div className="font-semibold">Item: {info?.itemName ?? "N/A"}</div>
                              <div>Turnover: {formatNumber(Number(info?.turnover ?? 0))}</div>
                              <div>Total Issues: {formatNumber(Number(info?.totalIssues ?? 0))}</div>
                              <div>Avg Stock: {formatNumber(Number(info?.avgStock ?? 0))}</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="turnover" fill={COLORS.purple} name="Turnover" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--card-bg)] p-5 shadow-card border border-[color:var(--border-color)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Actionable Risk Lists
            </h2>
            <div className="text-xs text-white/70">Prioritize replenishment and expiry</div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="w-full rounded-2xl bg-white/10 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                Top Reorder Risk Items
              </p>
              <div>
                <table className="w-full table-auto text-sm">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[30%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="text-xs uppercase text-white/60">
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Item ID</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Item Name</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Location ID</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Current Stock</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Min Threshold</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Gap</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/80">
                    {data.topReorderRiskItems.length === 0 && (
                      <tr>
                        <td className="px-2 py-5 text-center text-white/60" colSpan={7}>
                          No items currently require reorder based on selected filters.
                        </td>
                      </tr>
                    )}
                    {data.topReorderRiskItems.map((row, index) => (
                      <tr
                        key={`${row.itemId}-${row.item}-${index}`}
                        className="border-b border-white/10"
                      >
                        <td className="px-3 py-2 text-left tabular-nums whitespace-nowrap">
                          {row.itemId}
                        </td>
                        <td className="px-3 py-2 text-left whitespace-nowrap">{row.item}</td>
                        <td className="px-3 py-2 text-left tabular-nums whitespace-nowrap">{`LOC${String(
                          row.locationId
                        ).padStart(2, "0")}`}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatNumber(row.closingQty)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatNumber(row.minQty)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatNumber(row.gap)}
                        </td>
                        <td className="px-3 py-2 text-left whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${reorderStatusMeta(row.closingQty, row.minQty, row.gap).className}`}
                          >
                            {reorderStatusMeta(row.closingQty, row.minQty, row.gap).label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="w-full rounded-2xl bg-white/10 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                Top Expiry Risk Lots
              </p>
              <div>
                <table className="w-full table-auto text-sm">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[13%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[13%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead className="text-xs uppercase text-white/60">
                    <tr>
                      <th className="px-2 py-2 text-left whitespace-nowrap">Item</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">Lot</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">Expiry</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">Days Left</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">Qty</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">Value</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">Risk</th>
                      <th className="px-2 py-2 text-left whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/80">
                    {data.topExpiryRiskLots.length === 0 && (
                      <tr>
                        <td className="px-2 py-3 text-white/60" colSpan={8}>
                          No expiring lots in the selected scope.
                        </td>
                      </tr>
                    )}
                    {data.topExpiryRiskLots.map((row, index) => (
                      <tr key={`${row.lotNumber}-${index}`} className="border-b border-white/10">
                        <td className="px-2 py-2 text-left whitespace-nowrap">{row.item}</td>
                        <td className="px-2 py-2 text-left whitespace-nowrap">{row.lotNumber}</td>
                        <td className="px-2 py-2 text-left whitespace-nowrap">
                          {row.expiryDate || "-"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                          {Number.isFinite(Number(row.daysLeft))
                            ? formatInteger(Math.round(Number(row.daysLeft)))
                            : "-"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatNumber(row.qty)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatNumber(row.value)}
                        </td>
                        <td className="px-2 py-2 text-left whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${expiryRiskBadgeClass(row.riskLevel)}`}
                          >
                            {row.riskLevel}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-left whitespace-nowrap">{row.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--card-bg)] p-5 shadow-card border border-[color:var(--border-color)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Consumption Trends
            </h2>
            <div className="text-xs text-white/70">Derived from ISSUE events</div>
          </div>
          <div className="grid gap-6">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-center text-xs text-white/60">
                Demand Trend by Location
              </p>
              <p className="text-center text-[11px] text-[#5B6672]">
                Demand trend over time based on summed issues_qty by location_id.
              </p>
              {demandTrendData.length === 0 ? (
                <p className="mt-6 text-center text-sm text-white/60">
                  No data for selected filters.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={demandTrendData}
                      margin={{ left: 24, right: 14, top: 10, bottom: 14 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        ticks={demandTrendMonthlyTicks}
                        interval={0}
                        minTickGap={28}
                        height={58}
                        tickFormatter={formatMonthYearTick}
                      />
                      <YAxis
                        width={62}
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        label={{
                          value: "Demand Quantity",
                          angle: -90,
                          position: "insideLeft",
                          dx: -8,
                          fill: "#5B6672",
                          fontSize: 10,
                          fontWeight: 400,
                        }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white shadow">
                              <div className="font-semibold">{`Date: ${String(label)}`}</div>
                              {payload.map((entry) => (
                                <div key={String(entry.name)}>
                                  <span style={{ color: entry.color as string }}>
                                    {String(entry.name)}
                                  </span>
                                  {`: ${formatNumber(Number(entry.value ?? 0))}`}
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {demandTrendLocations.map((loc, idx) => {
                        const colorMap: Record<string, string> = {
                          LOC01: COLORS.blue,
                          LOC02: COLORS.purple,
                          LOC03: COLORS.yellow,
                        };
                        const fallbackPalette = [COLORS.blue, COLORS.purple, COLORS.yellow, COLORS.green];
                        return (
                          <Line
                            key={loc}
                            type="monotone"
                            dataKey={loc}
                            name={loc}
                            stroke={colorMap[loc] ?? fallbackPalette[idx % fallbackPalette.length]}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-center text-[10px] text-[#5B6672]">Top Consumed Items (Quantity)</p>
              {data.consumptionTopItems.length === 0 ? (
                <p className="mt-6 text-center text-sm text-white/60">
                  No data for selected filters.
                </p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.consumptionTopItems}
                      margin={{ left: 36, right: 36, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                      <XAxis
                        dataKey="itemId"
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        angle={0}
                        textAnchor="middle"
                        height={56}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        label={{
                          value: "Quantity Issued",
                          angle: -90,
                          position: "insideLeft",
                          dx: -6,
                          fill: "#5B6672",
                          fontSize: 10,
                          fontWeight: 400,
                        }}
                      />
                      <Tooltip
                        labelFormatter={(label, payload) => {
                          const info = payload?.[0]?.payload as { item?: string } | undefined;
                          return `Item ${label}${info?.item ? ` - ${info.item}` : ""}`;
                        }}
                        formatter={(v) => formatInteger(Number(v))}
                      />
                      <Bar dataKey="qty" fill={COLORS.purple} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-center text-[10px] text-[#5B6672]">Top Consumed Items by Value</p>
              <p className="mb-2 text-center text-[11px] text-[#5B6672]">
                Ranked by summed inventory_value across top consumed items.
              </p>
              {data.consumptionTopItemsByValue.length === 0 ? (
                <p className="mt-6 text-center text-sm text-white/60">
                  No data for selected filters.
                </p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.consumptionTopItemsByValue}
                      margin={{ left: 36, right: 36, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                      <XAxis
                        dataKey="itemId"
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        angle={0}
                        textAnchor="middle"
                        height={56}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        label={{
                          value: "Total Value (AED)",
                          angle: -90,
                          position: "insideLeft",
                          dx: -10,
                          dy: 30,
                          fill: "#5B6672",
                          fontSize: 10,
                          fontWeight: 400,
                        }}
                      />
                      <Tooltip
                        labelFormatter={(label, payload) => {
                          const info = payload?.[0]?.payload as { item?: string } | undefined;
                          return `Item ${label}${info?.item ? ` - ${info.item}` : ""}`;
                        }}
                        formatter={(v) => `${formatNumber(Number(v))} AED`}
                      />
                      <Bar dataKey="value" fill={COLORS.cyan} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--card-bg)] p-5 shadow-card border border-[color:var(--border-color)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Stock Movement Summary
            </h2>
            <div className="text-xs text-white/70">
              Range: {data.range.start} to {data.range.end}
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-center text-xs text-white/60">Receipts vs Issues</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={movementData} innerRadius={60} outerRadius={90} dataKey="value">
                      {movementData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatNumber(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs text-white/70">
                {movementData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: entry.color }}
                    />
                    <span>
                      {entry.name}: {formatNumber(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-center text-xs text-white/60">Movement by Location</p>
              <p className="text-center text-[11px] text-white/50">Qty in selected range</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.movementByLocation}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                    <XAxis
                      dataKey="location"
                      tick={{ fill: "#5B6672", fontSize: 10 }}
                      tickFormatter={shortLocationLabel}
                      height={50}
                    />
                    <YAxis tick={{ fill: "#5B6672", fontSize: 10 }} domain={[0, 500000]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const info = payload[0]?.payload as {
                          location: string;
                          receipts: number;
                          issues: number;
                          netMovement: number;
                        };
                        return (
                          <div className="rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white shadow">
                            <div className="font-semibold">{info.location}</div>
                            <div>Receipts: {formatNumber(info.receipts)}</div>
                            <div>Issues: {formatNumber(info.issues)}</div>
                            <div>
                              Net: {info.netMovement >= 0 ? "+" : ""}
                              {formatNumber(info.netMovement)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="receipts" fill={COLORS.cyan} name="Receipts (+)">
                      <LabelList
                        dataKey="receipts"
                        position="top"
                        offset={10}
                        formatter={(value) => formatInteger(Number(value ?? 0))}
                      />
                    </Bar>
                    <Bar dataKey="issues" fill={COLORS.red} name="Issues (−)">
                      <LabelList
                        dataKey="issues"
                        position="top"
                        offset={10}
                        formatter={(value) => formatInteger(Number(value ?? 0))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--card-bg)] p-5 shadow-card border border-[color:var(--border-color)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Movement & Event Feed
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
              <span>Most recent 50 events</span>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-[color:var(--text-main)]"
              >
                <option value="all">All Types</option>
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                value={eventLocationFilter}
                onChange={(e) => setEventLocationFilter(e.target.value)}
                className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-[color:var(--text-main)]"
              >
                <option value="all">All Locations</option>
                {eventLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <select
                value={eventItemIdFilter}
                onChange={(e) => setEventItemIdFilter(e.target.value)}
                className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-[color:var(--text-main)]"
              >
                <option value="all">All Item IDs</option>
                {eventItemIds.map((itemId) => (
                  <option key={itemId} value={itemId}>
                    {itemId}
                  </option>
                ))}
              </select>

              <div ref={eventDownloadRef} className="relative">
                <button
                  type="button"
                  onClick={() => setEventDownloadOpen((s) => !s)}
                  disabled={!eventFeedExportRows.length || exportingEventFeed !== null}
                  className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-[color:var(--text-main)] hover:bg-white/15 disabled:opacity-60"
                  aria-haspopup="menu"
                  aria-expanded={eventDownloadOpen}
                >
                  {exportingEventFeed ? "Exporting…" : "Download ▼"}
                </button>
                {eventDownloadOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-[var(--card-bg)] shadow-card"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEventDownloadOpen(false);
                        exportEventFeedExcel();
                      }}
                      className="w-full px-4 py-2 text-left text-[11px] text-white/80 hover:bg-white/10"
                      disabled={!eventFeedExportRows.length || exportingEventFeed !== null}
                    >
                      Export as Excel
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEventDownloadOpen(false);
                        exportEventFeedPdf();
                      }}
                      className="w-full px-4 py-2 text-left text-[11px] text-white/80 hover:bg-white/10"
                      disabled={!eventFeedExportRows.length || exportingEventFeed !== null}
                    >
                      Export as PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="max-h-[520px] overflow-x-auto overflow-y-auto rounded-2xl bg-white/10 p-4">
            <table className="w-full text-left text-xs text-white/80">
              <thead className="text-[11px] uppercase text-white/60">
                <tr>
                  <th className="py-2">Type</th>
                  <th>Item ID</th>
                  <th>Item Name</th>
                  <th>Location</th>
                  <th>Quantity</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 && (
                  <tr>
                    <td className="py-4 text-white/60" colSpan={6}>
                      No events for the selected filters.
                    </td>
                  </tr>
                )}
                {filteredEvents.map((event, index) => (
                  <tr key={`${event.itemId}-${event.timestamp ?? "na"}-${index}`} className="border-b border-white/10">
                    <td className={`py-2 ${eventTypeColor[event.type] ?? ""}`}>
                      {event.type}
                    </td>
                    <td>{event.itemId}</td>
                    <td className="max-w-[220px] truncate" title={eventItemNameById.get(String(event.itemId ?? "")) ?? ""}>
                      {eventItemNameById.get(String(event.itemId ?? "")) ?? "—"}
                    </td>
                    <td>{event.location}</td>
                    <td>{formatNumber(Math.abs(event.quantity))}</td>
                    <td>{event.timestamp ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--card-bg)] p-5 shadow-card border border-[color:var(--border-color)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Waste Performance
            </h2>
            <div className="text-xs text-white/70">
              Range: {data.range.start} to {data.range.end}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-1">
            <div className="rounded-2xl bg-white/10 p-4 text-center">
              <p className="text-xs text-white/70">Expiring Soon (60 days)</p>
              <p className="mt-2 text-3xl font-semibold">
                {formatNumber(data.expiringSoon60Days)}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-center text-xs text-white/60">Waste by Location</p>
              {data.wasteByLocation.length === 0 ? (
                <p className="mt-6 text-center text-sm text-white/60">
                  No waste data for the selected filters.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.wasteByLocation}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                      <XAxis dataKey="location_id" tick={{ fill: "#5B6672", fontSize: 10 }} />
                      <YAxis
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        label={{
                          value: "Waste Quantity",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#5B6672",
                          fontSize: 10,
                        }}
                      />
                      <Tooltip />
                      <Bar dataKey="waste_quantity" fill={COLORS.red} name="Waste Quantity" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-center text-xs text-white/60">Waste by Item</p>
              {wasteByItemChartData.length === 0 ? (
                <p className="mt-6 text-center text-sm text-white/60">
                  No waste data for the selected filters.
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wasteByItemChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                      <XAxis
                        dataKey="item_id"
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        interval="preserveStartEnd"
                        minTickGap={20}
                        height={36}
                      />
                      <YAxis
                        tick={{ fill: "#5B6672", fontSize: 10 }}
                        label={{
                          value: "Waste Quantity",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#5B6672",
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        formatter={(value) => formatInteger(Number(value ?? 0))}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as
                            | { item_label?: string; item_id?: number }
                            | undefined;
                          if (!row) return "";
                          return `${row.item_label ?? ""} (ID: ${row.item_id ?? "-"})`;
                        }}
                      />
                      <Bar dataKey="waste_quantity" fill={COLORS.purple} name="Waste Quantity" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-white/10 p-4">
            <p className="text-center text-xs text-white/60">Waste Trend Over Time</p>
            {data.wasteTrendOverTime.length === 0 ? (
              <p className="mt-6 text-center text-sm text-white/60">
                No waste data for the selected date range.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.wasteTrendOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9DEE5" />
                    <XAxis dataKey="event_date" tick={{ fill: "#5B6672", fontSize: 10 }} />
                    <YAxis
                      tick={{ fill: "#5B6672", fontSize: 10 }}
                      label={{
                        value: "Waste Quantity",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#5B6672",
                        fontSize: 10,
                      }}
                    />
                    <Tooltip formatter={(value) => formatInteger(Number(value ?? 0))} />
                    <Line
                      type="monotone"
                      dataKey="waste_quantity"
                      stroke={COLORS.red}
                      strokeWidth={2}
                      dot={false}
                      name="Waste Quantity"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      </main>
      <ChatWidget filters={filters} />
    </div>
  );
}
