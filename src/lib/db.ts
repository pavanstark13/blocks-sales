/**
 * Database abstraction:
 *   - Production (TURSO_DATABASE_URL set): uses Turso serverless SQLite
 *   - Development (local): uses better-sqlite3 against data/sales.db
 *
 * Both expose the same query() / execute() / run() interface so routes
 * don't need to know which backend is active.
 */

import type { ResultSet } from '@libsql/client';

const SCHEMA = `
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
  CREATE TABLE IF NOT EXISTS customer_rates (
    customer_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    rate REAL NOT NULL,
    PRIMARY KEY (customer_name, size)
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS customer_rate_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    rate REAL NOT NULL,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS production (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    size INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS rmc_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    customer_name TEXT,
    site_address TEXT,
    grade TEXT NOT NULL,
    quantity REAL NOT NULL,
    rate REAL,
    amount REAL,
    pump_charge REAL DEFAULT 0,
    total_amount REAL,
    advance REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    status TEXT DEFAULT 'CLOSED',
    payment_mode TEXT,
    notes TEXT,
    month_label TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS rmc_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS rmc_customer_rates (
    customer_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    rate REAL NOT NULL,
    PRIMARY KEY (customer_name, grade)
  );
  CREATE INDEX IF NOT EXISTS idx_sales_date      ON sales(date);
  CREATE INDEX IF NOT EXISTS idx_sales_status    ON sales(status);
  CREATE INDEX IF NOT EXISTS idx_sales_customer  ON sales(customer_name);
  CREATE INDEX IF NOT EXISTS idx_sales_month     ON sales(month_label);
  CREATE INDEX IF NOT EXISTS idx_payments_cust   ON payments(customer_name);
  CREATE INDEX IF NOT EXISTS idx_payments_date   ON payments(date);
  CREATE INDEX IF NOT EXISTS idx_rate_periods    ON customer_rate_periods(customer_name, size);
  CREATE INDEX IF NOT EXISTS idx_production_date ON production(date);
  CREATE INDEX IF NOT EXISTS idx_rmc_sales_date     ON rmc_sales(date);
  CREATE INDEX IF NOT EXISTS idx_rmc_sales_status   ON rmc_sales(status);
  CREATE INDEX IF NOT EXISTS idx_rmc_sales_customer ON rmc_sales(customer_name);
  CREATE INDEX IF NOT EXISTS idx_rmc_sales_month    ON rmc_sales(month_label);
  CREATE INDEX IF NOT EXISTS idx_rmc_payments_cust  ON rmc_payments(customer_name);
  CREATE TABLE IF NOT EXISTS rmc_cube_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    date TEXT NOT NULL,
    customer_name TEXT,
    site_address TEXT,
    grade TEXT NOT NULL,
    batch_date TEXT,
    quantity REAL,
    sample_count INTEGER DEFAULT 3,
    result_7day REAL,
    result_28day REAL,
    required_strength REAL,
    status TEXT DEFAULT 'PENDING',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_cube_tests_date ON rmc_cube_tests(date);
  CREATE INDEX IF NOT EXISTS idx_cube_tests_customer ON rmc_cube_tests(customer_name);
  CREATE TABLE IF NOT EXISTS customer_credit_limits (
    customer_name TEXT PRIMARY KEY,
    module TEXT NOT NULL DEFAULT 'blocks',
    credit_limit REAL NOT NULL,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS rmc_cement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    month_label TEXT,
    entry_type TEXT NOT NULL,
    vehicle_no TEXT,
    company TEXT,
    inward_total REAL DEFAULT 0,
    cem1_qty REAL DEFAULT 0,
    cem2_qty REAL DEFAULT 0,
    cem3_qty REAL DEFAULT 0,
    consumption_text TEXT,
    cem1_consumption REAL DEFAULT 0,
    cem2_consumption REAL DEFAULT 0,
    cem3_consumption REAL DEFAULT 0,
    cem1_balance REAL,
    cem2_balance REAL,
    cem3_balance REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rmc_cement_date  ON rmc_cement(date);
  CREATE INDEX IF NOT EXISTS idx_rmc_cement_month ON rmc_cement(month_label);
  CREATE INDEX IF NOT EXISTS idx_rmc_cement_type  ON rmc_cement(entry_type);
`;

// ── Unified row type ──────────────────────────────────────────────────────────
export type Row = Record<string, unknown>;

export interface DB {
  /** SELECT — returns array of rows */
  all(sql: string, ...args: unknown[]): Promise<Row[]>;
  /** SELECT single row (or undefined) */
  get(sql: string, ...args: unknown[]): Promise<Row | undefined>;
  /** INSERT / UPDATE / DELETE — returns { lastInsertRowid } */
  run(sql: string, ...args: unknown[]): Promise<{ lastInsertRowid: number | bigint }>;
}

// ── Turso (production) ────────────────────────────────────────────────────────
function makeTurso(): DB {
  // Dynamic import so the package is only loaded when actually needed
  const clientPromise = import('@libsql/client').then(({ createClient }) =>
    createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  );

  async function exec(sql: string, args: unknown[]): Promise<ResultSet> {
    const client = await clientPromise;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return client.execute({ sql, args: args as any });
  }

  // Migrations: ADD COLUMN statements that are safe to re-run (fail silently if column exists)
  const MIGRATIONS = [
    `ALTER TABLE sales ADD COLUMN vehicle_no TEXT`,
  ];

  // Run schema once per process
  let schemaReady: Promise<void> | null = null;
  function ensureSchema() {
    if (!schemaReady) {
      schemaReady = (async () => {
        const client = await clientPromise;
        for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
          await client.execute(stmt);
        }
        for (const m of MIGRATIONS) {
          try { await client.execute(m); } catch { /* column already exists */ }
        }
      })();
    }
    return schemaReady;
  }

  return {
    async all(sql, ...args) {
      await ensureSchema();
      const rs = await exec(sql, args);
      return rs.rows as unknown as Row[];
    },
    async get(sql, ...args) {
      await ensureSchema();
      const rs = await exec(sql, args);
      return rs.rows[0] as unknown as Row | undefined;
    },
    async run(sql, ...args) {
      await ensureSchema();
      const rs = await exec(sql, args);
      return { lastInsertRowid: rs.lastInsertRowid ?? 0 };
    },
  };
}

// ── Local SQLite (development) ────────────────────────────────────────────────
function makeLocal(): DB {
  // Lazy require so build doesn't fail on Vercel (better-sqlite3 is native)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSQLite = require('better-sqlite3');
  const path = require('path');
  const fs = require('fs');

  const dbPath = path.join(process.cwd(), 'data', 'sales.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sqlite = new BetterSQLite(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(SCHEMA);
  // Migrations (safe to re-run)
  for (const m of [`ALTER TABLE sales ADD COLUMN vehicle_no TEXT`]) {
    try { sqlite.exec(m); } catch { /* already exists */ }
  }

  return {
    async all(sql, ...args) { return sqlite.prepare(sql).all(...args) as Row[]; },
    async get(sql, ...args) { return sqlite.prepare(sql).get(...args) as Row | undefined; },
    async run(sql, ...args) {
      const r = sqlite.prepare(sql).run(...args);
      return { lastInsertRowid: r.lastInsertRowid };
    },
  };
}

// ── Singleton ─────────────────────────────────────────────────────────────────
let _db: DB | null = null;

export function db(): DB {
  if (!_db) {
    _db = process.env.TURSO_DATABASE_URL ? makeTurso() : makeLocal();
  }
  return _db;
}
