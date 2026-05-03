PRAGMA foreign_keys = ON;

-- Inventory Tools
CREATE TABLE IF NOT EXISTS abc_snapshots (
  snapshot_id INTEGER PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS abc_snapshot_lines (
  line_id INTEGER PRIMARY KEY,
  snapshot_id INTEGER NOT NULL REFERENCES abc_snapshots(snapshot_id),
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  annual_value_aed REAL DEFAULT 0,
  annual_qty REAL DEFAULT 0,
  value_share_pct REAL DEFAULT 0,
  cumulative_share_pct REAL DEFAULT 0,
  abc_class TEXT
);

CREATE TABLE IF NOT EXISTS eoq_parameters (
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

CREATE TABLE IF NOT EXISTS rop_parameters (
  rop_id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  location_id INTEGER REFERENCES locations(location_id),
  daily_demand_avg REAL DEFAULT 0,
  lead_time_days REAL DEFAULT 0,
  safety_stock_qty REAL DEFAULT 0,
  review_date TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS safety_stock_parameters (
  safety_stock_id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  location_id INTEGER REFERENCES locations(location_id),
  demand_std_dev REAL DEFAULT 0,
  lead_time_days REAL DEFAULT 0,
  service_level_z REAL DEFAULT 0,
  review_date TEXT,
  notes TEXT
);

-- Warehouse
CREATE TABLE IF NOT EXISTS warehouse_space_metrics (
  metric_id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(location_id),
  metric_date TEXT NOT NULL,
  total_capacity_m3 REAL DEFAULT 0,
  used_capacity_m3 REAL DEFAULT 0,
  occupancy_pct REAL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS warehouse_capacity_forecast (
  forecast_id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(location_id),
  forecast_period TEXT NOT NULL,
  forecast_used_capacity_m3 REAL DEFAULT 0,
  forecast_occupancy_pct REAL DEFAULT 0,
  expansion_recommended INTEGER DEFAULT 0,
  recommendation_text TEXT
);

CREATE TABLE IF NOT EXISTS labor_productivity_metrics (
  labor_metric_id INTEGER PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(location_id),
  metric_date TEXT NOT NULL,
  labor_hours REAL DEFAULT 0,
  lines_processed INTEGER DEFAULT 0,
  units_moved REAL DEFAULT 0,
  productivity_index REAL DEFAULT 0,
  notes TEXT
);

-- Risk
CREATE TABLE IF NOT EXISTS risk_register (
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

CREATE TABLE IF NOT EXISTS risk_assessments (
  assessment_id INTEGER PRIMARY KEY,
  risk_id INTEGER NOT NULL REFERENCES risk_register(risk_id),
  assessment_date TEXT NOT NULL,
  probability_score INTEGER DEFAULT 0,
  impact_score INTEGER DEFAULT 0,
  disruption_days_est REAL DEFAULT 0,
  estimated_cost_aed REAL DEFAULT 0,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS mitigation_actions (
  action_id INTEGER PRIMARY KEY,
  risk_id INTEGER NOT NULL REFERENCES risk_register(risk_id),
  action_title TEXT NOT NULL,
  owner TEXT,
  due_date TEXT,
  completion_pct REAL DEFAULT 0,
  status TEXT,
  notes TEXT
);

-- Vendor
CREATE TABLE IF NOT EXISTS supplier_kpis (
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

CREATE TABLE IF NOT EXISTS supplier_scores (
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

