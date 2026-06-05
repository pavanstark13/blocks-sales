/**
 * Uploads all data from the local SQLite DB to Turso.
 * Run once after setting up Turso:
 *
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-turso.ts
 */
import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';

const url   = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url) { console.error('Set TURSO_DATABASE_URL'); process.exit(1); }

const remote = createClient({ url, authToken: token });
const local  = new Database(path.join(process.cwd(), 'data', 'sales.db'));

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, customer_name TEXT, address TEXT, phone TEXT,
    size INTEGER NOT NULL, quantity INTEGER NOT NULL, rate REAL, amount REAL,
    advance REAL DEFAULT 0, balance REAL DEFAULT 0, status TEXT DEFAULT 'CLOSED',
    payment_mode TEXT, notes TEXT, month_label TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales(date);
  CREATE INDEX IF NOT EXISTS idx_sales_status   ON sales(status);
  CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_name);
  CREATE INDEX IF NOT EXISTS idx_sales_month    ON sales(month_label);
`;

async function main() {
  console.log('Creating schema on Turso...');
  for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    await remote.execute(stmt);
  }

  const rows = local.prepare('SELECT * FROM sales ORDER BY id').all() as Record<string, unknown>[];
  console.log(`Uploading ${rows.length} rows...`);

  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await remote.batch(
      batch.map(r => ({
        sql: `INSERT OR IGNORE INTO sales
              (id,date,customer_name,address,phone,size,quantity,rate,amount,advance,balance,status,payment_mode,notes,month_label,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: [r.id,r.date,r.customer_name,r.address,r.phone,r.size,r.quantity,r.rate,r.amount,r.advance,r.balance,r.status,r.payment_mode,r.notes,r.month_label,r.created_at] as any,
      }))
    );
    process.stdout.write(`\r${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
