import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q        = searchParams.get('q');
  const dateFrom = searchParams.get('date_from');
  const dateTo   = searchParams.get('date_to');

  let sql = `
    SELECT customer_name, MAX(address) as address, MAX(phone) as phone,
      COUNT(*) as total_orders, SUM(quantity) as total_qty,
      SUM(CASE WHEN size=4 THEN quantity ELSE 0 END) as qty_4,
      SUM(CASE WHEN size=6 THEN quantity ELSE 0 END) as qty_6,
      SUM(CASE WHEN size=8 THEN quantity ELSE 0 END) as qty_8,
      ROUND(SUM(COALESCE(amount,0)),2)  as total_amount,
      ROUND(SUM(COALESCE(balance,0)),2) as outstanding,
      MAX(date) as last_order
    FROM sales WHERE customer_name IS NOT NULL
  `;
  const params: unknown[] = [];

  if (q) {
    sql += ' AND (customer_name LIKE ? OR address LIKE ? OR phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (dateFrom) { sql += ' AND date >= ?'; params.push(dateFrom); }
  if (dateTo)   { sql += ' AND date <= ?'; params.push(dateTo); }

  sql += ' GROUP BY customer_name ORDER BY last_order DESC';

  const rows = await db().all(sql, ...params);
  return NextResponse.json(rows);
}

// PATCH /api/customers
// Body: { old_name, new_name }
// Renames a customer across ALL tables. If new_name already exists, this merges them.
export async function PATCH(req: NextRequest) {
  const { old_name, new_name, new_address, new_phone } = await req.json();
  if (!old_name || !new_name) {
    return NextResponse.json({ error: 'old_name and new_name required' }, { status: 400 });
  }

  const trimmed = new_name.trim();
  if (!trimmed) return NextResponse.json({ error: 'new_name cannot be empty' }, { status: 400 });

  const database = db();

  // Update all tables that reference customer_name
  await database.run(`UPDATE sales SET customer_name = ? WHERE customer_name = ?`, trimmed, old_name);
  await database.run(`UPDATE payments SET customer_name = ? WHERE customer_name = ?`, trimmed, old_name);
  await database.run(`UPDATE customer_rates SET customer_name = ? WHERE customer_name = ?`, trimmed, old_name);
  await database.run(`UPDATE customer_rate_periods SET customer_name = ? WHERE customer_name = ?`, trimmed, old_name);

  // If address/phone edits were requested, update the most recent sales record for this customer
  if (new_address !== undefined || new_phone !== undefined) {
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (new_address !== undefined) { updates.push('address = ?'); vals.push(new_address); }
    if (new_phone   !== undefined) { updates.push('phone = ?');   vals.push(new_phone); }
    vals.push(trimmed);
    await database.run(
      `UPDATE sales SET ${updates.join(', ')} WHERE customer_name = ?`,
      ...vals
    );
  }

  return NextResponse.json({ ok: true, merged: trimmed !== old_name });
}
