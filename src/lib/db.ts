import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'sales.db');

function getDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      customer_name TEXT,
      address TEXT,
      phone TEXT,
      size INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      rate REAL,
      amount REAL,
      advance REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      status TEXT DEFAULT 'CLOSED',
      payment_mode TEXT,
      notes TEXT,
      month_label TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_name);
    CREATE INDEX IF NOT EXISTS idx_sales_month ON sales(month_label);
  `);
}

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (!_db) _db = getDb();
  return _db;
}
