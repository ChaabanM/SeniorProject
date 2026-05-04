import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(
  process.cwd(),
  "..",
  "database",
  "seeds",
  "dss_inventory_demo.db"
);
let dbWrite: Database.Database | null = null;

export function getDbWrite() {
  if (!dbWrite) {
    dbWrite = new Database(dbPath);
  }
  return dbWrite;
}

