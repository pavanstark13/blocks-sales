import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import salesData from './data.json';

const SECRET = 'seed-blocks-2025';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url   = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url) return NextResponse.json({ error: 'TURSO_DATABASE_URL not set' }, { status: 500 });

  const client = createClient({ url, authToken: token });

  // Create schema
  await client.execute(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY, date TEXT NOT NULL, customer_name TEXT, address TEXT, phone TEXT,
    size INTEGER NOT NULL, quantity INTEGER NOT NULL, rate REAL, amount REAL,
    advance REAL DEFAULT 0, balance REAL DEFAULT 0, status TEXT DEFAULT 'CLOSED',
    payment_mode TEXT, notes TEXT, month_label TEXT, created_at TEXT
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales(date)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sales_status   ON sales(status)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_name)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sales_month    ON sales(month_label)`);

  // Check existing count
  const existing = await client.execute('SELECT COUNT(*) as cnt FROM sales');
  const already = Number((existing.rows[0] as Record<string, unknown>).cnt);
  if (already >= salesData.length) {
    return NextResponse.json({ message: `Already seeded: ${already} rows`, done: true });
  }

  // Insert in batches of 50
  const BATCH = 50;
  let inserted = 0;
  const rows = salesData as Record<string, unknown>[];

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await client.batch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch.map(r => ({
        sql: `INSERT OR IGNORE INTO sales
              (id,date,customer_name,address,phone,size,quantity,rate,amount,advance,balance,status,payment_mode,notes,month_label,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: [r.id,r.date,r.customer_name,r.address,r.phone,r.size,r.quantity,r.rate,r.amount,r.advance,r.balance,r.status,r.payment_mode,r.notes,r.month_label,r.created_at] as any,
      }))
    );
    inserted += batch.length;
  }

  return NextResponse.json({ message: `Seeded ${inserted} rows successfully`, done: true });
}
