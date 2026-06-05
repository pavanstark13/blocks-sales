import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const database = db();

  const monthSummary = database.prepare(`
    SELECT
      month_label,
      COUNT(*) as orders,
      SUM(quantity) as total_qty,
      SUM(CASE WHEN size = 4 THEN quantity ELSE 0 END) as qty_4,
      SUM(CASE WHEN size = 6 THEN quantity ELSE 0 END) as qty_6,
      SUM(CASE WHEN size = 8 THEN quantity ELSE 0 END) as qty_8,
      ROUND(SUM(COALESCE(amount, 0)), 2) as total_amount,
      ROUND(SUM(COALESCE(advance, 0)), 2) as total_advance,
      ROUND(SUM(COALESCE(balance, 0)), 2) as total_balance,
      COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_orders,
      COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
      COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_orders
    FROM sales
    GROUP BY month_label
    ORDER BY MIN(date)
  `).all();

  const outstanding = database.prepare(`
    SELECT id, date, customer_name, address, phone, size, quantity, rate, amount, advance, balance, status, payment_mode, month_label
    FROM sales
    WHERE status IN ('OPEN', 'PENDING')
    ORDER BY date DESC
  `).all();

  const topCustomers = database.prepare(`
    SELECT
      customer_name,
      COUNT(*) as orders,
      SUM(quantity) as total_qty,
      ROUND(SUM(COALESCE(amount, 0)), 2) as total_amount,
      ROUND(SUM(COALESCE(balance, 0)), 2) as outstanding
    FROM sales
    WHERE customer_name IS NOT NULL
    GROUP BY customer_name
    ORDER BY total_amount DESC
    LIMIT 20
  `).all();

  const paymentBreakdown = database.prepare(`
    SELECT
      COALESCE(payment_mode, 'UNKNOWN') as mode,
      COUNT(*) as orders,
      ROUND(SUM(COALESCE(amount, 0)), 2) as total
    FROM sales
    GROUP BY payment_mode
    ORDER BY total DESC
  `).all();

  const sizeSummary = database.prepare(`
    SELECT
      size,
      COUNT(*) as orders,
      SUM(quantity) as total_qty,
      ROUND(AVG(NULLIF(rate, 0)), 2) as avg_rate,
      ROUND(SUM(COALESCE(amount, 0)), 2) as total_amount
    FROM sales
    GROUP BY size
    ORDER BY size
  `).all();

  const totals = database.prepare(`
    SELECT
      COUNT(*) as total_orders,
      SUM(quantity) as total_blocks,
      ROUND(SUM(COALESCE(amount, 0)), 2) as total_revenue,
      ROUND(SUM(COALESCE(balance, 0)), 2) as total_outstanding,
      COUNT(DISTINCT customer_name) as unique_customers
    FROM sales
  `).get();

  return NextResponse.json({ monthSummary, outstanding, topCustomers, paymentBreakdown, sizeSummary, totals });
}
