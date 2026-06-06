import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const customerName = searchParams.get('customer_name');

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (dateFrom) { where += ' AND date >= ?'; params.push(dateFrom); }
  if (dateTo)   { where += ' AND date <= ?'; params.push(dateTo); }
  if (customerName) { where += ' AND customer_name = ?'; params.push(customerName); }

  const rows = await db().all(
    `SELECT
       customer_name,
       site_address,
       COUNT(*)                                              AS order_count,
       SUM(quantity)                                         AS total_quantity,
       SUM(COALESCE(total_amount, 0))                        AS total_amount,
       SUM(COALESCE(balance, 0))                             AS total_balance,
       SUM(CASE WHEN grade = 'M10' THEN quantity ELSE 0 END) AS qty_m10,
       SUM(CASE WHEN grade = 'M15' THEN quantity ELSE 0 END) AS qty_m15,
       SUM(CASE WHEN grade = 'M20' THEN quantity ELSE 0 END) AS qty_m20,
       SUM(CASE WHEN grade = 'M25' THEN quantity ELSE 0 END) AS qty_m25,
       SUM(CASE WHEN grade = 'M30' THEN quantity ELSE 0 END) AS qty_m30,
       SUM(CASE WHEN grade = 'M35' THEN quantity ELSE 0 END) AS qty_m35,
       SUM(CASE WHEN grade = 'M40' THEN quantity ELSE 0 END) AS qty_m40,
       MAX(date)                                             AS last_delivery_date
     FROM rmc_sales
     ${where}
     GROUP BY customer_name, site_address
     ORDER BY last_delivery_date DESC`,
    ...params
  );

  return NextResponse.json(rows);
}
