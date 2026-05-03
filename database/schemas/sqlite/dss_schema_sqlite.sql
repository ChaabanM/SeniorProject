PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  org_id INTEGER PRIMARY KEY,
  organization_code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS item_categories (
  category_id INTEGER PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  category_description TEXT
);

CREATE TABLE IF NOT EXISTS item_types (
  item_type_id INTEGER PRIMARY KEY,
  item_type_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS uoms (
  uom_id INTEGER PRIMARY KEY,
  uom_code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS locations (
  location_id INTEGER PRIMARY KEY,
  org_id INTEGER REFERENCES organizations (org_id),
  location_code TEXT NOT NULL,
  UNIQUE (org_id, location_code)
);

CREATE TABLE IF NOT EXISTS items (
  item_id INTEGER PRIMARY KEY,
  item_number TEXT NOT NULL UNIQUE,
  item_description TEXT,
  item_type_id INTEGER REFERENCES item_types (item_type_id),
  category_id INTEGER REFERENCES item_categories (category_id),
  item_class TEXT,
  uom_id INTEGER REFERENCES uoms (uom_id)
);

CREATE TABLE IF NOT EXISTS inventory_events (
  event_id INTEGER PRIMARY KEY,
  org_id INTEGER REFERENCES organizations (org_id),
  location_id INTEGER REFERENCES locations (location_id),
  item_id INTEGER REFERENCES items (item_id),
  event_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  uom_id INTEGER REFERENCES uoms (uom_id),
  unit_cost REAL,
  total_cost REAL,
  event_ts TEXT,
  is_aggregate INTEGER NOT NULL DEFAULT 0,
  source_file TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_events_item_ts
  ON inventory_events (item_id, event_ts);

CREATE INDEX IF NOT EXISTS idx_inventory_events_location_ts
  ON inventory_events (location_id, event_ts);

CREATE TABLE IF NOT EXISTS inventory_period_balances (
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  org_id INTEGER REFERENCES organizations (org_id),
  location_id INTEGER REFERENCES locations (location_id),
  item_id INTEGER REFERENCES items (item_id),
  opening_qty REAL,
  receipts_qty REAL,
  issues_qty REAL,
  closing_qty REAL,
  inventory_value REAL,
  unit_cost REAL,
  source_file TEXT,
  PRIMARY KEY (period_start, period_end, org_id, location_id, item_id)
);

CREATE TABLE IF NOT EXISTS min_max_levels (
  org_id INTEGER REFERENCES organizations (org_id),
  location_id INTEGER REFERENCES locations (location_id),
  item_id INTEGER REFERENCES items (item_id),
  uom_id INTEGER REFERENCES uoms (uom_id),
  min_qty REAL,
  max_qty REAL,
  planning_code TEXT,
  source_subinventory TEXT,
  created_at TEXT,
  updated_at TEXT,
  PRIMARY KEY (org_id, location_id, item_id)
);

CREATE TABLE IF NOT EXISTS consumption (
  org_id INTEGER REFERENCES organizations (org_id),
  location_id INTEGER REFERENCES locations (location_id),
  item_id INTEGER REFERENCES items (item_id),
  uom_id INTEGER REFERENCES uoms (uom_id),
  quantity REAL,
  unit_cost REAL,
  total_cost REAL,
  abc_class TEXT,
  period TEXT,
  source_file TEXT
);

CREATE TABLE IF NOT EXISTS expiry_waste (
  org_id INTEGER REFERENCES organizations (org_id),
  location_id INTEGER REFERENCES locations (location_id),
  item_id INTEGER REFERENCES items (item_id),
  uom_id INTEGER REFERENCES uoms (uom_id),
  quantity REAL,
  unit_cost REAL,
  total_cost REAL,
  reason TEXT,
  lot_number TEXT,
  lot_expiry TEXT,
  event_ts TEXT,
  source_file TEXT
);

CREATE TABLE IF NOT EXISTS forecast_results (
  item_id INTEGER REFERENCES items (item_id),
  location_id INTEGER REFERENCES locations (location_id),
  forecast_date TEXT NOT NULL,
  forecast_qty REAL,
  model_name TEXT,
  confidence REAL,
  generated_at TEXT DEFAULT (datetime('now'))
);
