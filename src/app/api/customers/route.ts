import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  let query = `
    SELECT
      customer_name,
      MAX(address) as address,
      MAX(phone) as phone,
      COUNT(*) as total_orders,
      SUM(quantity) as total_qty,
      ROUND(SUM(COALESCE(amount, 0)), 2) as total_amount,
      ROUND(SUM(COALESCE(balance, 0)), 2) as outstanding,
      MAX(date) as last_order
    FROM sales
    WHERE customer_name IS NOT NULL
  `;
  const params: string[] = [];

  if (q) {
    query += ' AND customer_name LIKE ?';
    params.push(`%${q}%`);
  }

  query += ' GROUP BY customer_name ORDER BY last_order DESC';

  const rows = db().prepare(query).all(...params);
  return NextResponse.json(rows);
}
