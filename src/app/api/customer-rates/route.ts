import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/customer-rates?customer=Name
// Returns { rates: { 4: 42, 6: 38, 8: 45 } }
export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('customer');
  if (!name) return NextResponse.json({ rates: {} });

  const rows = await db().all(
    'SELECT size, rate FROM customer_rates WHERE customer_name = ?',
    name
  );
  const rates: Record<number, number> = {};
  for (const r of rows) rates[Number(r.size)] = Number(r.rate);
  return NextResponse.json({ rates });
}

// POST /api/customer-rates
// Body: { customer_name, size, rate }  — upserts one size/rate pair
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
