import Database from "better-sqlite3";
import path from "path";

// Inventory SQLite lives under database/seeds (same as backend .env SQLITE_DB_PATH).
const dbPath = path.join(
  process.cwd(),
  "..",
  "database",
  "seeds",
  "dss_inventory_demo.db"
);
let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    db = new Database(dbPath, { readonly: true });
  }
  return db;
}
