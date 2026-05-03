# Scripts

Development utilities, ETL, and tool scripts.

## Structure

### `/dev`
Development scripts:
- `seed_item_location_events.py` - Seed location event data
- `load_warehouse_module_data.py` - Load warehouse metrics
- `seed-auth.js` - Seed authentication database with test users

### `/etl`
Extract, Transform, Load scripts:
- `etl_load_sqlite.py` - Load CSV data into SQLite database

### `/tools`
Utility tools:
- `delete_google_sheet_ingested_rows.py` - Remove synced rows from Google Sheet
- `fix_item_names.py` - Batch fix item naming issues

## Usage

### Seed Test Data
```bash
cd dev
python seed_item_location_events.py
python load_warehouse_module_data.py
node seed-auth.js
```

### Load Data into Database
```bash
cd etl
python etl_load_sqlite.py
```

### Maintenance Tools
```bash
cd tools
python fix_item_names.py
python delete_google_sheet_ingested_rows.py
```

## Notes
- All scripts use environment variables for configuration
- Database paths are relative to project root
- Some scripts are Windows-specific (paths, PowerShell)
