import Database from "better-sqlite3";

export type UserRow = {
  email: string;
  password_hash: string;
  role: "INVENTORY_MANAGER" | "PROCUREMENT_RISK_MANAGER";
  created_at: string;
};

let _db: Database.Database | null = null;

function getDbPath() {
  // Keep auth DB co-located with the web app.
  return process.env.AUTH_DB_PATH ?? "auth.db";
}

export function getAuthDb(): Database.Database {
  if (_db) return _db;
  const db = new Database(getDbPath());
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  _db = db;
  return db;
}

export function getUserByEmail(email: string): UserRow | null {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const db = getAuthDb();
  const row = db
    .prepare(
      `SELECT email, password_hash, role, created_at
       FROM auth_users
       WHERE email = ?`
    )
    .get(normalized) as UserRow | undefined;
  return row ?? null;
}

