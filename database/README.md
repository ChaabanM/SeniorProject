# Database

Organized database files, schemas, and ETL scripts.

## Structure

### `/schemas`
Database schema files for different SQL dialects:
- `postgres/` - PostgreSQL schemas
- `sqlite/` - SQLite schemas and migrations

### `/seeds`
Database files for development and testing:
- `dss_inventory_demo.db` - Demo dataset
- `dss_inventory.db` - Production dataset

### Schemas Available
- `dss_schema_postgres.sql` - PostgreSQL schema (normalized, scalable)
- `dss_schema_sqlite.sql` - SQLite schema (same as Postgres, adapted)
- `dss_schema_non_archive.sql` - Extended schema with additional tables
- `db_new_modules_schema.sql` - New module tables

## Usage

### Load SQLite Database
```bash
cd ../scripts/etl
python etl_load_sqlite.py
```

### PostgreSQL Setup
```bash
# Use the Postgres schema
psql -U username -d database_name -f schemas/postgres/dss_schema_postgres.sql
```

## Notes
- Schemas support inventory, supplier, warehouse, and risk data
- Append-only mode for data integrity
- Deduplication via unique constraints
