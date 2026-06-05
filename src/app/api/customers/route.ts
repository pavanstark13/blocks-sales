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
