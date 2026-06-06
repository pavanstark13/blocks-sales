import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search   = searchParams.get('search') || searchParams.get('q');
  const dateFrom = searchParams.get('date_from');
  const dateTo   = searchParams.get('date_to');

  let sql = `
    SELECT customer_name,
      COUNT(*) as order_count,
      ROUND(SUM(quantity), 1) as total_quantity,
      ROUND(SUM(COALESCE(total_amount,0)), 2) as total_amount,
      ROUND(SUM(COALESCE(advance,0)), 2) as total_advance,
      ROUND(SUM(COALESCE(balance,0)), 2) as total_balance,
      ROUND(SUM(CASE WHEN grade='M10' THEN quantity ELSE 0 END), 1) as qty_m10,
      ROUND(SUM(CASE WHEN grade='M15' THEN quantity ELSE 0 END), 1) as qty_m15,
      ROUND(SUM(CASE WHEN grade='M20' THEN quantity ELSE 0 END), 1) as qty_m20,
      ROUND(SUM(CASE WHEN grade='M25' THEN quantity ELSE 0 END), 1) as qty_m25,
      ROUND(SUM(CASE WHEN grade='M30' THEN quantity ELSE 0 END), 1) as qty_m30,
      MAX(date) as last_order_date
    FROM rmc_sales WHERE customer_name IS NOT NULL
  `;
  const params: unknown[] = [];

  if (search) {
    sql += ' AND customer_name LIKE ?';
    params.push(`%${search}%`);
  }
  if (dateFrom) { sql += ' AND date >= ?'; params.push(dateFrom); }
  if (dateTo)   { sql += ' AND date <= ?'; params.push(dateTo); }

  sql += ' GROUP BY customer_name ORDER BY last_order_date DESC';

  const rows = await db().all(sql, ...params);
  return NextResponse.json(rows);
}

// PATCH /api/rmc/customers
// Body: { old_name, new_name } — rename or merge
// Body: { old_name, merge_into } — merge old_name into merge_into
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { old_name, new_name, merge_into } = body;

  const target = (merge_into || new_name || '').trim();
  if (!old_name || !target) {
    return NextResponse.json({ error: 'old_name and new_name (or merge_into) required' }, { status: 400 });
  }

  const database = db();

  // Reassign all records to target name
  await database.run(`UPDATE rmc_sales SET customer_name = ? WHERE customer_name = ?`, target, old_name);
  await database.run(`UPDATE rmc_payments SET customer_name = ? WHERE customer_name = ?`, target, old_name);

  if (merge_into) {
    // When merging, remove the old customer's standalone rates (target's rates take precedence)
    await database.run(`DELETE FROM rmc_customer_rates WHERE customer_name = ?`, old_name);
  } else {
    await database.run(`UPDATE rmc_customer_rates SET customer_name = ? WHERE customer_name = ?`, target, old_name);
  }

  return NextResponse.json({ ok: true, target });
}
