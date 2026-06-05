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
  CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales(date);
  CREATE INDEX IF NOT EXISTS idx_sales_status   ON sales(status);
  CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_name);
  CREATE INDEX IF NOT EXISTS idx_sales_month    ON sales(month_label);
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

  // Run schema once per process
  let schemaReady: Promise<void> | null = null;
  function ensureSchema() {
    if (!schemaReady) {
      schemaReady = (async () => {
        const client = await clientPromise;
        for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
          await client.execute(stmt);
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
