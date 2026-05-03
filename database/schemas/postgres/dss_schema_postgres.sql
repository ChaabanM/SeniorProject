CREATE TABLE IF NOT EXISTS organizations (
  org_id BIGSERIAL PRIMARY KEY,
  organization_code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS item_categories (
  category_id BIGSERIAL PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  category_description TEXT
);

CREATE TABLE IF NOT EXISTS item_types (
  item_type_id BIGSERIAL PRIMARY KEY,
  item_type_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS uoms (
  uom_id BIGSERIAL PRIMARY KEY,
  uom_code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS locations (
  location_id BIGSERIAL PRIMARY KEY,
  org_id BIGINT REFERENCES organizations (org_id),
  location_code TEXT NOT NULL,
  UNIQUE (org_id, location_code)
);

CREATE TABLE IF NOT EXISTS items (
  item_id BIGSERIAL PRIMARY KEY,
  item_number TEXT NOT NULL UNIQUE,
  item_description TEXT,
  item_type_id BIGINT REFERENCES item_types (item_type_id),
  category_id BIGINT REFERENCES item_categories (category_id),
  item_class TEXT,
  uom_id BIGINT REFERENCES uoms (uom_id)
);

CREATE TABLE IF NOT EXISTS inventory_events (
  event_id BIGSERIAL PRIMARY KEY,
  org_id BIGINT REFERENCES organizations (org_id),
  location_id BIGINT REFERENCES locations (location_id),
  item_id BIGINT REFERENCES items (item_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('OPENING','RECEIPT','ISSUE','ADJUST','EXPIRE','WASTE')),
  quantity NUMERIC(18,4) NOT NULL,
  uom_id BIGINT REFERENCES uoms (uom_id),
  unit_cost NUMERIC(18,6),
  total_cost NUMERIC(18,6),
  event_ts TIMESTAMP WITHOUT TIME ZONE,
  is_aggregate BOOLEAN NOT NULL DEFAULT FALSE,
  source_file TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_events_item_ts
  ON inventory_events (item_id, event_ts);

CREATE INDEX IF NOT EXISTS idx_inventory_events_location_ts
  ON inventory_events (location_id, event_ts);

CREATE TABLE IF NOT EXISTS inventory_period_balances (
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  org_id BIGINT REFERENCES organizations (org_id),
  location_id BIGINT REFERENCES locations (location_id),
  item_id BIGINT REFERENCES items (item_id),
  opening_qty NUMERIC(18,4),
  receipts_qty NUMERIC(18,4),
  issues_qty NUMERIC(18,4),
  closing_qty NUMERIC(18,4),
  inventory_value NUMERIC(18,6),
  unit_cost NUMERIC(18,6),
  source_file TEXT,
  PRIMARY KEY (period_start, period_end, org_id, location_id, item_id)
);

CREATE TABLE IF NOT EXISTS min_max_levels (
  org_id BIGINT REFERENCES organizations (org_id),
  location_id BIGINT REFERENCES locations (location_id),
  item_id BIGINT REFERENCES items (item_id),
  uom_id BIGINT REFERENCES uoms (uom_id),
  min_qty NUMERIC(18,4),
  max_qty NUMERIC(18,4),
  planning_code TEXT,
  source_subinventory TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITHOUT TIME ZONE,
  PRIMARY KEY (org_id, location_id, item_id)
);

CREATE TABLE IF NOT EXISTS consumption (
  org_id BIGINT REFERENCES organizations (org_id),
  location_id BIGINT REFERENCES locations (location_id),
  item_id BIGINT REFERENCES items (item_id),
  uom_id BIGINT REFERENCES uoms (uom_id),
  quantity NUMERIC(18,4),
  unit_cost NUMERIC(18,6),
  total_cost NUMERIC(18,6),
  abc_class TEXT,
  period TEXT,
  source_file TEXT
);

CREATE TABLE IF NOT EXISTS expiry_waste (
  org_id BIGINT REFERENCES organizations (org_id),
  location_id BIGINT REFERENCES locations (location_id),
  item_id BIGINT REFERENCES items (item_id),
  uom_id BIGINT REFERENCES uoms (uom_id),
  quantity NUMERIC(18,4),
  unit_cost NUMERIC(18,6),
  total_cost NUMERIC(18,6),
  reason TEXT,
  lot_number TEXT,
  lot_expiry DATE,
  event_ts TIMESTAMP WITHOUT TIME ZONE,
  source_file TEXT
);

CREATE TABLE IF NOT EXISTS forecast_results (
  item_id BIGINT REFERENCES items (item_id),
  location_id BIGINT REFERENCES locations (location_id),
  forecast_date DATE NOT NULL,
  forecast_qty NUMERIC(18,4),
  model_name TEXT,
  confidence NUMERIC(6,4),
  generated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
