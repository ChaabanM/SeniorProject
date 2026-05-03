-- Non-archive schema for dss_inventory_demo.db
-- Generated from sqlite_master (tables and views only).

-- === TABLE: abc_snapshot_lines ===
CREATE TABLE abc_snapshot_lines (
  line_id INTEGER PRIMARY KEY,
  snapshot_id INTEGER NOT NULL REFERENCES abc_snapshots(snapshot_id),
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  annual_value_aed REAL DEFAULT 0,
  annual_qty REAL DEFAULT 0,
  value_share_pct REAL DEFAULT 0,
  cumulative_share_pct REAL DEFAULT 0,
  abc_class TEXT
);

-- === TABLE: abc_snapshots ===
CREATE TABLE abc_snapshots (
  snapshot_id INTEGER PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- === TABLE: categories ===
CREATE TABLE categories (
  category_id INTEGER PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE
);

-- === TABLE: categories_v ===
CREATE TABLE categories_v (
  dataset_id TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  category_name TEXT NOT NULL,
  PRIMARY KEY (dataset_id, category_id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(dataset_id)
);

-- === TABLE: datasets ===
CREATE TABLE datasets (
  dataset_id TEXT PRIMARY KEY,
  dataset_name TEXT NOT NULL,
  source_file TEXT,
  imported_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  notes TEXT
);

-- === TABLE: eoq_parameters ===
CREATE TABLE eoq_parameters (
  eoq_id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  location_id INTEGER REFERENCES locations(location_id),
  annual_demand_qty REAL DEFAULT 0,
  ordering_cost_aed REAL DEFAULT 0,
  holding_cost_aed_per_unit_year REAL DEFAULT 0,
  lead_time_days REAL DEFAULT 0,
  review_date TEXT,
  notes TEXT
);

-- === TABLE: ingest_scan_ids ===
CREATE TABLE ingest_scan_ids (scan_id TEXT PRIMARY KEY, ingested_at TEXT NOT NULL);

-- === TABLE: inventory_events ===
CREATE TABLE inventory_events (
  event_id INTEGER PRIMARY KEY,
  event_ts TEXT NOT NULL, -- ISO timestamp
  event_type TEXT NOT NULL, -- RECEIPT, ISSUE, ADJUSTMENT_WASTE
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  location_id INTEGER NOT NULL REFERENCES locations(location_id),
  performed_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
  quantity INTEGER NOT NULL, -- RECEIPT positive, ISSUE negative, WASTE negative
  unit_cost_aed REAL NOT NULL,
  notes TEXT
);

-- === TABLE: inventory_events_v ===
CREATE TABLE inventory_events_v (
  dataset_id TEXT NOT NULL,
  event_id INTEGER NOT NULL,
  event_ts TEXT NOT NULL,
  event_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  performed_by_user_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost_aed REAL NOT NULL,
  notes TEXT,
  PRIMARY KEY (dataset_id, event_id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(dataset_id)
);

-- === TABLE: item_lots ===
CREATE TABLE item_lots (
  lot_id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  lot_number TEXT NOT NULL,
  expiry_date TEXT NOT NULL, -- ISO date
  qty_on_hand INTEGER NOT NULL
);

-- === TABLE: item_lots_v ===
CREATE TABLE item_lots_v (
  dataset_id TEXT NOT NULL,
  lot_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  lot_number TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  qty_on_hand INTEGER NOT NULL,
  PRIMARY KEY (dataset_id, lot_id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(dataset_id)
);

-- === TABLE: items ===
CREATE TABLE items (
  item_id INTEGER PRIMARY KEY,
  item_code TEXT NOT NULL UNIQUE,
  item_name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(category_id),
  location_id INTEGER NOT NULL REFERENCES locations(location_id),
  uom TEXT NOT NULL,
  min_qty INTEGER NOT NULL,
  max_qty INTEGER NOT NULL,
  current_qty INTEGER NOT NULL,
  unit_cost_aed REAL NOT NULL,
  is_critical INTEGER NOT NULL DEFAULT 0
);

-- === TABLE: items_v ===
CREATE TABLE items_v (
  dataset_id TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  uom TEXT NOT NULL,
  min_qty INTEGER NOT NULL,
  max_qty INTEGER NOT NULL,
  current_qty INTEGER NOT NULL,
  unit_cost_aed REAL NOT NULL,
  is_critical INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dataset_id, item_id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(dataset_id)
);

-- === TABLE: labor_productivity_metrics ===
CREATE TABLE labor_productivity_metrics (
  labor_metric_id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(location_id),
  metric_date TEXT NOT NULL,
  labor_hours REAL DEFAULT 0,
  lines_processed INTEGER DEFAULT 0,
  units_moved REAL DEFAULT 0,
  productivity_index REAL DEFAULT 0,
  notes TEXT
);

-- === TABLE: locations ===
CREATE TABLE locations (
  location_id INTEGER PRIMARY KEY,
  location_code TEXT NOT NULL UNIQUE,
  location_name TEXT NOT NULL
);

-- === TABLE: locations_v ===
CREATE TABLE locations_v (
  dataset_id TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  location_code TEXT NOT NULL,
  location_name TEXT NOT NULL,
  PRIMARY KEY (dataset_id, location_id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(dataset_id)
);

-- === TABLE: mitigation_actions ===
CREATE TABLE mitigation_actions (
  action_id INTEGER PRIMARY KEY,
  risk_id INTEGER NOT NULL REFERENCES risk_register(risk_id),
  action_title TEXT NOT NULL,
  owner TEXT,
  due_date TEXT,
  completion_pct REAL DEFAULT 0,
  status TEXT,
  notes TEXT
);

-- === TABLE: raw_inventory_v ===
CREATE TABLE "raw_inventory_v" (
"dataset_id" TEXT,
  "date" TIMESTAMP,
  "org_id" TEXT,
  "location_id" TEXT,
  "item_id" REAL,
  "item_name" TEXT,
  "current_stock_avg" REAL,
  "current_stock_avg_rounded" REAL,
  "event_time_stamps" TIMESTAMP,
  "event_type" TEXT,
  "quantity" REAL,
  "uom_id" REAL,
  "unit_cost_large_box" REAL,
  "total_cost" REAL,
  "is_aggregate" REAL,
  "period_start" TIMESTAMP,
  "period_end" TIMESTAMP,
  "opening_qty" REAL,
  "receipts_qty" REAL,
  "issues_qty" REAL,
  "closing_qty" REAL,
  "inventory_value" REAL,
  "min_qty" REAL,
  "max_qty" REAL,
  "planning_code" TEXT,
  "source_subinventory" REAL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP,
  "period" TEXT,
  "reason" TEXT,
  "lot_number" TEXT,
  "lot_expiry" TIMESTAMP,
  "avg_usage_per_day" REAL,
  "restock_lead_time" REAL,
  "vendor_id" TEXT,
  "holding_rate_20" REAL,
  "order_cost_assumed" REAL,
  "annual_demand" REAL,
  "annual_consumption_value" REAL,
  "of_total_value" REAL,
  "eoq" REAL
);

-- === TABLE: raw_labor_productivity_metrics_v ===
CREATE TABLE "raw_labor_productivity_metrics_v" (
"dataset_id" TEXT,
  "labor_id" TEXT,
  "metric_date" TIMESTAMP,
  "labor_hours" REAL,
  "overtime_hours" REAL,
  "units_moved" INTEGER,
  "productivity_index" REAL
);

-- === TABLE: raw_orderssheet_v ===
CREATE TABLE "raw_orderssheet_v" (
"dataset_id" TEXT,
  "order_date" TIMESTAMP,
  "item_id" INTEGER,
  "item_name" TEXT,
  "event_type" TEXT,
  "ordered_quantity" INTEGER,
  "receipts_qty" INTEGER,
  "in_full_quantity" INTEGER,
  "unit_cost" REAL,
  "restock_lead_time" INTEGER,
  "vendor_id" TEXT,
  "actual_date" TIMESTAMP,
  "promised_date" TIMESTAMP,
  "defective_units" INTEGER,
  "on_time_delivery" INTEGER,
  "days_late" INTEGER,
  "defect_rate" REAL,
  "order_accuracy" REAL,
  "otif" INTEGER,
  "unnamed_18" REAL,
  "unnamed_19" REAL,
  "unnamed_20" TEXT,
  "unnamed_21" TEXT,
  "unnamed_22" TEXT
);

-- === TABLE: raw_pivot_cost_v ===
CREATE TABLE "raw_pivot_cost_v" (
"dataset_id" TEXT,
  "unnamed_0" TEXT,
  "unnamed_1" TEXT,
  "unnamed_2" TEXT
);

-- === TABLE: raw_pivot_items_v ===
CREATE TABLE "raw_pivot_items_v" (
"dataset_id" TEXT,
  "row_labels" INTEGER,
  "average_of_current_stock" REAL,
  "item_names" TEXT
);

-- === TABLE: raw_risk_and_actions_v ===
CREATE TABLE "raw_risk_and_actions_v" (
"dataset_id" TEXT,
  "assessment_id" TEXT,
  "risk_id" REAL,
  "assessment_date" TIMESTAMP,
  "probability_score" REAL,
  "impact_score" REAL,
  "disruption_days_est" REAL,
  "estimated_cost_aed" REAL,
  "summary" TEXT,
  "risk_code" TEXT,
  "risk_title" TEXT,
  "risk_category" TEXT,
  "risk_level" TEXT,
  "owner" TEXT,
  "status" TEXT,
  "identified_date" TIMESTAMP,
  "action_id" TEXT,
  "action_title" TEXT,
  "action_owner" TEXT,
  "due_date" TEXT,
  "completion_pct" REAL,
  "action_status" TEXT,
  "action_notes" TEXT
);

-- === TABLE: raw_vendorkpi_v ===
CREATE TABLE "raw_vendorkpi_v" (
"dataset_id" TEXT,
  "supplier" TEXT,
  "lead_time_days_avg" REAL,
  "score_date" TIMESTAMP,
  "quality_score" REAL,
  "delivery_score" REAL,
  "otif" REAL,
  "average_cost" REAL,
  "cost_score" REAL,
  "total_score" REAL,
  "grade" TEXT
);

-- === TABLE: raw_warehouse_v ===
CREATE TABLE "raw_warehouse_v" (
"dataset_id" TEXT,
  "item_id" INTEGER,
  "item_name" TEXT,
  "event_time_stamps" TIMESTAMP,
  "quantity" INTEGER,
  "volume_in_m_3" REAL,
  "item_volume" REAL,
  "unnamed_6" REAL,
  "unnamed_7" REAL,
  "total_volume" REAL,
  "capacity_m_3" REAL,
  "utilization" REAL
);

-- === TABLE: risk_assessments ===
CREATE TABLE risk_assessments (
  assessment_id INTEGER PRIMARY KEY,
  risk_id INTEGER NOT NULL REFERENCES risk_register(risk_id),
  assessment_date TEXT NOT NULL,
  probability_score INTEGER DEFAULT 0,
  impact_score INTEGER DEFAULT 0,
  disruption_days_est REAL DEFAULT 0,
  estimated_cost_aed REAL DEFAULT 0,
  summary TEXT
);

-- === TABLE: risk_register ===
CREATE TABLE risk_register (
  risk_id INTEGER PRIMARY KEY,
  risk_code TEXT UNIQUE,
  risk_title TEXT NOT NULL,
  risk_category TEXT,
  probability_score INTEGER DEFAULT 0,
  impact_score INTEGER DEFAULT 0,
  risk_level TEXT,
  owner TEXT,
  status TEXT,
  identified_date TEXT,
  notes TEXT
);

-- === TABLE: roles ===
CREATE TABLE roles (
  role_id INTEGER PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE
);

-- === TABLE: roles_v ===
CREATE TABLE roles_v (
  dataset_id TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  role_name TEXT NOT NULL,
  PRIMARY KEY (dataset_id, role_id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(dataset_id)
);

-- === TABLE: rop_parameters ===
CREATE TABLE rop_parameters (
  rop_id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  location_id INTEGER REFERENCES locations(location_id),
  daily_demand_avg REAL DEFAULT 0,
  lead_time_days REAL DEFAULT 0,
  safety_stock_qty REAL DEFAULT 0,
  review_date TEXT,
  notes TEXT
);

-- === TABLE: safety_stock_parameters ===
CREATE TABLE safety_stock_parameters (
  safety_stock_id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  location_id INTEGER REFERENCES locations(location_id),
  demand_std_dev REAL DEFAULT 0,
  lead_time_days REAL DEFAULT 0,
  service_level_z REAL DEFAULT 0,
  review_date TEXT,
  notes TEXT
);

-- === TABLE: supplier_kpis ===
CREATE TABLE supplier_kpis (
  supplier_kpi_id INTEGER PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  on_time_delivery_pct REAL DEFAULT 0,
  fill_rate_pct REAL DEFAULT 0,
  defect_rate_pct REAL DEFAULT 0,
  lead_time_days_avg REAL DEFAULT 0,
  notes TEXT
);

-- === TABLE: supplier_scores ===
CREATE TABLE supplier_scores (
  supplier_score_id INTEGER PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  score_date TEXT NOT NULL,
  quality_score REAL DEFAULT 0,
  delivery_score REAL DEFAULT 0,
  cost_score REAL DEFAULT 0,
  risk_score REAL DEFAULT 0,
  total_score REAL DEFAULT 0,
  grade TEXT,
  notes TEXT
);

-- === TABLE: users ===
CREATE TABLE users (
  user_id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role_id INTEGER NOT NULL REFERENCES roles(role_id)
);

-- === TABLE: users_v ===
CREATE TABLE users_v (
  dataset_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  PRIMARY KEY (dataset_id, user_id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(dataset_id)
);

-- === TABLE: warehouse_capacity_forecast ===
CREATE TABLE warehouse_capacity_forecast (
  forecast_id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(location_id),
  forecast_period TEXT NOT NULL,
  forecast_used_capacity_m3 REAL DEFAULT 0,
  forecast_occupancy_pct REAL DEFAULT 0,
  expansion_recommended INTEGER DEFAULT 0,
  recommendation_text TEXT
);

-- === TABLE: warehouse_space_metrics ===
CREATE TABLE warehouse_space_metrics (
  metric_id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(location_id),
  metric_date TEXT NOT NULL,
  total_capacity_m3 REAL DEFAULT 0,
  used_capacity_m3 REAL DEFAULT 0,
  occupancy_pct REAL DEFAULT 0,
  notes TEXT
);
