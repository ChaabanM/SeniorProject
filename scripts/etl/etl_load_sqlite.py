import csv
import os
import sqlite3
from datetime import datetime

BASE_DIR = r"C:\Users\alsen\Desktop\senior project\hospital data dubai"
DB_PATH = r"C:\Users\alsen\Desktop\dss_dashboard_project\dss_inventory.db"
SCHEMA_PATH = r"C:\Users\alsen\Desktop\dss_dashboard_project\dss_schema_sqlite.sql"

FILES = {
    "categories": os.path.join(BASE_DIR, "1.Item category and description.csv"),
    "item_types": os.path.join(BASE_DIR, "2.Item type.csv"),
    "closing_balance": os.path.join(BASE_DIR, "3.Quantity on hand – closing balance per period.csv"),
    "opening_receipts_issues": os.path.join(BASE_DIR, "4.Opening Stock Quantity received and quantity issued (2).csv"),
    "min_max": os.path.join(BASE_DIR, "5.Minimum and maximum stock levels.csv"),
    "consumption": os.path.join(BASE_DIR, "10.Consolidated Item Consumption Report.csv"),
    "expiry": os.path.join(BASE_DIR, "11.Expired, wasted, or damaged item quantities.csv"),
}


def parse_float(value):
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if text == "" or text.lower() == "null":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_date(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def parse_datetime(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).isoformat()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return None


def find_header_line(path, required_columns):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        for idx, line in enumerate(f):
            row = [c.strip() for c in line.split(",")]
            if all(col in row for col in required_columns):
                return idx, row
    raise ValueError(f"Header not found in {path}")


def iter_rows_from_header(path, header_line_index):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        for _ in range(header_line_index):
            next(f)
        reader = csv.DictReader(f)
        for row in reader:
            yield row


def load_schema(conn):
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())


def get_id(conn, table, key_col, key_value, id_col):
    cur = conn.execute(f"SELECT {id_col} FROM {table} WHERE {key_col} = ?", (key_value,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur = conn.execute(f"INSERT INTO {table} ({key_col}) VALUES (?)", (key_value,))
    return cur.lastrowid


def get_org_id(conn, org_code):
    if not org_code:
        org_code = "UNKNOWN"
    return get_id(conn, "organizations", "organization_code", org_code, "org_id")


def get_uom_id(conn, uom_code):
    if not uom_code:
        return None
    return get_id(conn, "uoms", "uom_code", uom_code, "uom_id")


def get_category_id(conn, category_name, category_description=None):
    if not category_name:
        return None
    cur = conn.execute(
        "SELECT category_id, category_description FROM item_categories WHERE category_name = ?",
        (category_name,),
    )
    row = cur.fetchone()
    if row:
        if category_description and not row[1]:
            conn.execute(
                "UPDATE item_categories SET category_description = ? WHERE category_id = ?",
                (category_description, row[0]),
            )
        return row[0]
    cur = conn.execute(
        "INSERT INTO item_categories (category_name, category_description) VALUES (?, ?)",
        (category_name, category_description),
    )
    return cur.lastrowid


def get_item_type_id(conn, item_type_name):
    if not item_type_name:
        return None
    return get_id(conn, "item_types", "item_type_name", item_type_name, "item_type_id")


def get_location_id(conn, org_id, location_code):
    if not location_code:
        return None
    cur = conn.execute(
        "SELECT location_id FROM locations WHERE org_id = ? AND location_code = ?",
        (org_id, location_code),
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur = conn.execute(
        "INSERT INTO locations (org_id, location_code) VALUES (?, ?)",
        (org_id, location_code),
    )
    return cur.lastrowid


def get_item_id(conn, item_number, description=None, category_name=None, item_class=None, uom_code=None, item_type_name=None):
    if not item_number:
        return None
    cur = conn.execute(
        "SELECT item_id, item_description, category_id, item_class, uom_id, item_type_id FROM items WHERE item_number = ?",
        (item_number,),
    )
    row = cur.fetchone()
    category_id = get_category_id(conn, category_name) if category_name else None
    uom_id = get_uom_id(conn, uom_code)
    item_type_id = get_item_type_id(conn, item_type_name)
    if row:
        updates = []
        params = []
        if description and not row[1]:
            updates.append("item_description = ?")
            params.append(description)
        if category_id and not row[2]:
            updates.append("category_id = ?")
            params.append(category_id)
        if item_class and not row[3]:
            updates.append("item_class = ?")
            params.append(item_class)
        if uom_id and not row[4]:
            updates.append("uom_id = ?")
            params.append(uom_id)
        if item_type_id and not row[5]:
            updates.append("item_type_id = ?")
            params.append(item_type_id)
        if updates:
            params.append(row[0])
            conn.execute(f"UPDATE items SET {', '.join(updates)} WHERE item_id = ?", params)
        return row[0]
    cur = conn.execute(
        "INSERT INTO items (item_number, item_description, item_type_id, category_id, item_class, uom_id) VALUES (?, ?, ?, ?, ?, ?)",
        (item_number, description, item_type_id, category_id, item_class, uom_id),
    )
    return cur.lastrowid


def load_categories(conn):
    with open(FILES["categories"], "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            get_category_id(conn, row.get("Category Name"), row.get("Category Description"))


def load_item_types(conn):
    with open(FILES["item_types"], "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if not row:
                continue
            item_type = row[0].strip()
            if item_type:
                get_item_type_id(conn, item_type)


def load_closing_balance(conn):
    required = [
        "Inventory Organization Code",
        "Subinventory Name",
        "Item Name",
        "Unit Cost",
        "Costed Onhand Quantity",
        "Costed Onhand Amount",
        "End Date",
        "Start Date",
    ]
    header_idx, _ = find_header_line(FILES["closing_balance"], required)
    for row in iter_rows_from_header(FILES["closing_balance"], header_idx):
        org_code = row.get("Inventory Organization Code")
        location_code = row.get("Subinventory Name")
        item_number = row.get("Item Name")
        unit_cost = parse_float(row.get("Unit Cost"))
        closing_qty = parse_float(row.get("Costed Onhand Quantity"))
        inventory_value = parse_float(row.get("Costed Onhand Amount"))
        period_end = parse_date(row.get("End Date"))
        period_start = parse_date(row.get("Start Date"))

        org_id = get_org_id(conn, org_code)
        location_id = get_location_id(conn, org_id, location_code)
        item_id = get_item_id(conn, item_number)

        if not (period_start and period_end and item_id and location_id):
            continue

        conn.execute(
            """
            INSERT OR REPLACE INTO inventory_period_balances
            (period_start, period_end, org_id, location_id, item_id, closing_qty, inventory_value, unit_cost, source_file)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (period_start, period_end, org_id, location_id, item_id, closing_qty, inventory_value, unit_cost, os.path.basename(FILES["closing_balance"])),
        )


def load_opening_receipts_issues(conn):
    required = [
        "Valuation Unit",
        "Category",
        "Item",
        "Description",
        "UOM",
        "Unit Cost",
        "Opening Quantity",
        "Receipts",
        "Issues",
        "Closing Quantity",
        "Inventory Value",
    ]
    header_idx, _ = find_header_line(FILES["opening_receipts_issues"], required)

    period_start = None
    period_end = None
    with open(FILES["opening_receipts_issues"], "r", encoding="utf-8-sig", newline="") as f:
        for line in f:
            if "Period Start" in line:
                period_start = parse_date(line.split(",")[-1])
            if "Period End" in line:
                period_end = parse_date(line.split(",")[-1])
            if period_start and period_end:
                break

    for row in iter_rows_from_header(FILES["opening_receipts_issues"], header_idx):
        location_code = row.get("Valuation Unit")
        category_name = row.get("Category")
        item_number = row.get("Item")
        description = row.get("Description")
        uom_code = row.get("UOM")
        unit_cost = parse_float(row.get("Unit Cost"))
        opening_qty = parse_float(row.get("Opening Quantity"))
        receipts_qty = parse_float(row.get("Receipts"))
        issues_qty = parse_float(row.get("Issues"))
        closing_qty = parse_float(row.get("Closing Quantity"))
        inventory_value = parse_float(row.get("Inventory Value"))

        org_id = get_org_id(conn, "HOSPITAL_DUBAI_LLC")
        location_id = get_location_id(conn, org_id, location_code)
        item_id = get_item_id(conn, item_number, description=description, category_name=category_name, uom_code=uom_code)
        uom_id = get_uom_id(conn, uom_code)

        if not (period_start and period_end and item_id and location_id):
            continue

        conn.execute(
            """
            INSERT OR REPLACE INTO inventory_period_balances
            (period_start, period_end, org_id, location_id, item_id, opening_qty, receipts_qty, issues_qty, closing_qty, inventory_value, unit_cost, source_file)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                period_start,
                period_end,
                org_id,
                location_id,
                item_id,
                opening_qty,
                receipts_qty,
                issues_qty,
                closing_qty,
                inventory_value,
                unit_cost,
                os.path.basename(FILES["opening_receipts_issues"]),
            ),
        )

        if opening_qty:
            conn.execute(
                """
                INSERT INTO inventory_events
                (org_id, location_id, item_id, event_type, quantity, uom_id, unit_cost, total_cost, event_ts, is_aggregate, source_file)
                VALUES (?, ?, ?, 'OPENING', ?, ?, ?, ?, ?, 1, ?)
                """,
                (org_id, location_id, item_id, opening_qty, uom_id, unit_cost, None, period_start, os.path.basename(FILES["opening_receipts_issues"])),
            )
        if receipts_qty:
            conn.execute(
                """
                INSERT INTO inventory_events
                (org_id, location_id, item_id, event_type, quantity, uom_id, unit_cost, total_cost, event_ts, is_aggregate, source_file)
                VALUES (?, ?, ?, 'RECEIPT', ?, ?, ?, ?, ?, 1, ?)
                """,
                (org_id, location_id, item_id, receipts_qty, uom_id, unit_cost, None, period_end, os.path.basename(FILES["opening_receipts_issues"])),
            )
        if issues_qty:
            conn.execute(
                """
                INSERT INTO inventory_events
                (org_id, location_id, item_id, event_type, quantity, uom_id, unit_cost, total_cost, event_ts, is_aggregate, source_file)
                VALUES (?, ?, ?, 'ISSUE', ?, ?, ?, ?, ?, 1, ?)
                """,
                (org_id, location_id, item_id, issues_qty, uom_id, unit_cost, None, period_end, os.path.basename(FILES["opening_receipts_issues"])),
            )


def load_min_max(conn):
    with open(FILES["min_max"], "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            org_code = row.get("ORGANIZATION_CODE")
            location_code = row.get("DESTINATION")
            item_number = row.get("ITEM_NUMBER")
            uom_code = row.get("MINMAX_QUANTITY_UOM")
            min_qty = parse_float(row.get("MIN_MINMAX_QUANTITY"))
            max_qty = parse_float(row.get("MAX_MINMAX_QUANTITY"))
            planning_code = row.get("INVENTORY_PLANNING_CODE")
            source_subinventory = row.get("SOURCE_SUBINVENTORY")
            created_at = parse_datetime(row.get("CREATION_DATE"))
            updated_at = parse_datetime(row.get("LAST_UPDATE_DATE"))

            org_id = get_org_id(conn, org_code)
            location_id = get_location_id(conn, org_id, location_code)
            item_id = get_item_id(conn, item_number, uom_code=uom_code)
            uom_id = get_uom_id(conn, uom_code)

            if not (org_id and location_id and item_id):
                continue

            conn.execute(
                """
                INSERT INTO min_max_levels
                (org_id, location_id, item_id, uom_id, min_qty, max_qty, planning_code, source_subinventory, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(org_id, location_id, item_id) DO UPDATE SET
                  uom_id = excluded.uom_id,
                  min_qty = excluded.min_qty,
                  max_qty = excluded.max_qty,
                  planning_code = excluded.planning_code,
                  source_subinventory = excluded.source_subinventory,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at
                """,
                (org_id, location_id, item_id, uom_id, min_qty, max_qty, planning_code, source_subinventory, created_at, updated_at),
            )


def load_consumption(conn):
    with open(FILES["consumption"], "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            org_code = row.get("ORGANIZATION_CODE")
            location_code = row.get("Location")
            item_number = row.get("ITEM_NUMBER")
            category_name = row.get("CATEGORY")
            item_class = row.get("ITEM_CLASS")
            uom_code = row.get("PRIMARY_UOM_CODE")
            unit_cost = parse_float(row.get("UNIT_COST"))
            quantity = parse_float(row.get("QUANTITY"))
            total_cost = parse_float(row.get("COST"))
            abc_class = row.get("ABCCLASS")

            org_id = get_org_id(conn, org_code)
            location_id = get_location_id(conn, org_id, location_code)
            item_id = get_item_id(conn, item_number, category_name=category_name, item_class=item_class, uom_code=uom_code)
            uom_id = get_uom_id(conn, uom_code)

            if not (org_id and location_id and item_id):
                continue

            conn.execute(
                """
                INSERT INTO consumption
                (org_id, location_id, item_id, uom_id, quantity, unit_cost, total_cost, abc_class, period, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (org_id, location_id, item_id, uom_id, quantity, unit_cost, total_cost, abc_class, None, os.path.basename(FILES["consumption"])),
            )


def load_expiry(conn):
    with open(FILES["expiry"], "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            org_code = row.get("Source")
            event_ts = parse_datetime(row.get("Txn Date"))
            item_number = row.get("Item")
            location_code = row.get("Location")
            quantity = parse_float(row.get("Quantity"))
            uom_code = row.get("UOM")
            unit_cost = parse_float(row.get("Unit Cost"))
            total_cost = parse_float(row.get("Value"))
            reason = row.get("Reason")
            category_name = row.get("Category")
            lot_number = row.get("Lot Number")
            lot_expiry = parse_date(row.get("Lot Expiry Date"))

            org_id = get_org_id(conn, org_code)
            location_id = get_location_id(conn, org_id, location_code)
            item_id = get_item_id(conn, item_number, category_name=category_name, uom_code=uom_code)
            uom_id = get_uom_id(conn, uom_code)

            if not (org_id and location_id and item_id):
                continue

            conn.execute(
                """
                INSERT INTO expiry_waste
                (org_id, location_id, item_id, uom_id, quantity, unit_cost, total_cost, reason, lot_number, lot_expiry, event_ts, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (org_id, location_id, item_id, uom_id, quantity, unit_cost, total_cost, reason, lot_number, lot_expiry, event_ts, os.path.basename(FILES["expiry"])),
            )

            event_type = "WASTE" if (reason and "waste" in reason.lower()) else "EXPIRE"
            conn.execute(
                """
                INSERT INTO inventory_events
                (org_id, location_id, item_id, event_type, quantity, uom_id, unit_cost, total_cost, event_ts, is_aggregate, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                """,
                (org_id, location_id, item_id, event_type, quantity, uom_id, unit_cost, total_cost, event_ts, os.path.basename(FILES["expiry"])),
            )


def main():
    conn = sqlite3.connect(DB_PATH)
    try:
        load_schema(conn)
        load_categories(conn)
        load_item_types(conn)
        load_closing_balance(conn)
        load_opening_receipts_issues(conn)
        load_min_max(conn)
        load_consumption(conn)
        load_expiry(conn)
        conn.commit()
    finally:
        conn.close()

    print(f"Database created at: {DB_PATH}")


if __name__ == "__main__":
    main()
