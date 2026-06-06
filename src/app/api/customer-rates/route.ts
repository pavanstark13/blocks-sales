import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/customer-rates?customer=Name&date=YYYY-MM-DD
// Returns { rates: { 4: 42, 6: 38, 8: 45 } }
// If date is provided, also checks rate periods and uses those over fixed rates
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('customer');
  const date = searchParams.get('date');
  if (!name) return NextResponse.json({ rates: {} });

  const database = db();

  // Fixed rates (default)
  const fixedRows = await database.all(
    'SELECT size, rate FROM customer_rates WHERE customer_name = ?', name
  );
  const rates: Record<number, number> = {};
  for (const r of fixedRows) rates[Number(r.size)] = Number(r.rate);

  // If date provided, check rate periods and override fixed rates
  if (date) {
    const periodRows = await database.all(
      `SELECT size, rate FROM customer_rate_periods
       WHERE customer_name = ? AND date_from <= ? AND date_to >= ?`,
      name, date, date
    );
    for (const r of periodRows) rates[Number(r.size)] = Number(r.rate);
  }

  return NextResponse.json({ rates });
}

// POST /api/customer-rates  — upsert a fixed rate for a customer+size
export async function POST(req: NextRequest) {
  const { customer_name, size, rate } = await req.json();
  if (!customer_name || !size || rate == null) {
    return NextResponse.json({ error: 'customer_name, size, rate required' }, { status: 400 });
  }
  await db().run(
    `INSERT INTO customer_rates (customer_name, size, rate)
     VALUES (?, ?, ?)
     ON CONFLICT(customer_name, size) DO UPDATE SET rate = excluded.rate`,
    customer_name, size, rate
  );
  return NextResponse.json({ ok: true });
}
