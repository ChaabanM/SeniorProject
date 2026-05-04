/**
 * Reset auth DB and seed default dashboard users.
 * Run from web/: node seed-auth.js
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dbPath = process.env.AUTH_DB_PATH
  ? path.resolve(process.env.AUTH_DB_PATH)
  : path.join(__dirname, "auth.db");

const PASSWORD = "ChangeMe123!";
const BCRYPT_ROUNDS = 10;

const USERS = [
  { email: "inventory.manager@gmail.com", role: "INVENTORY_MANAGER" },
  { email: "procurement.manager@gmail.com", role: "PROCUREMENT_RISK_MANAGER" },
];

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS auth_users (
    email TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const hash = bcrypt.hashSync(PASSWORD, BCRYPT_ROUNDS);
const insert = db.prepare(`
  INSERT INTO auth_users (email, password_hash, role, created_at)
  VALUES (?, ?, ?, ?)
`);

const now = new Date().toISOString();
for (const u of USERS) {
  insert.run(u.email.trim().toLowerCase(), hash, u.role, now);
}

db.close();
console.log("Auth database reset at:", dbPath);
console.log("Users (password for all: ChangeMe123!):");
for (const u of USERS) {
  console.log(" ", u.email, "->", u.role);
}
