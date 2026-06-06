import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/rmc/customer-rates?customer=Name
// Returns { rates: { M10: 3500, M20: 4200, ... } }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('customer');
  if (!name) return NextResponse.json({ rates: {} });

  const rows = await db().all(
    'SELECT grade, rate FROM rmc_customer_rates WHERE customer_name = ?', name
  );
  const rates: Record<string, number> = {};
  for (const r of rows) rates[String(r.grade)] = Number(r.rate);

  return NextResponse.json({ rates });
}

// POST /api/rmc/customer-rates — upsert rate for customer+grade
export async function POST(req: NextRequest) {
  const { customer_name, grade, rate } = await req.json();
  if (!customer_name || !grade || rate == null) {
    return NextResponse.json({ error: 'customer_name, grade, rate required' }, { status: 400 });
  }
  await db().run(
    `INSERT INTO rmc_customer_rates (customer_name, grade, rate)
     VALUES (?, ?, ?)
     ON CONFLICT(customer_name, grade) DO UPDATE SET rate = excluded.rate`,
    customer_name, grade, rate
  );
  return NextResponse.json({ ok: true });
}

// DELETE /api/rmc/customer-rates?customer=Name&grade=M20
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name  = searchParams.get('customer');
  const grade = searchParams.get('grade');
  if (!name || !grade) {
    return NextResponse.json({ error: 'customer and grade required' }, { status: 400 });
  }
  await db().run(
    'DELETE FROM rmc_customer_rates WHERE customer_name = ? AND grade = ?', name, grade
  );
  return NextResponse.json({ ok: true });
}
