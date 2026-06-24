import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  const database = db();
  const dateFilter = from && to ? `WHERE date BETWEEN '${from}' AND '${to}'` : '';

  const [monthly, sizeBreakdown, topCustomers, paymentModes, ageing, totalStats, collectionByMonth] =
    await Promise.all([
      database.all(`
        SELECT
          month_label,
          MIN(date) as first_date,
          SUM(quantity) as volume,
          ROUND(SUM(COALESCE(amount,0)),0) as revenue,
          ROUND(SUM(COALESCE(balance,0)),0) as outstanding,
          COUNT(*) as orders,
          COUNT(DISTINCT customer_name) as customers
        FROM sales ${dateFilter}
        GROUP BY month_label ORDER BY MIN(date) ASC
      `),
      database.all(`
        SELECT size,
          SUM(quantity) as volume,
          ROUND(SUM(COALESCE(amount,0)),0) as revenue,
          COUNT(*) as orders,
          ROUND(AVG(NULLIF(rate,0)),0) as avg_rate
        FROM sales ${dateFilter}
        GROUP BY size ORDER BY size ASC
      `),
      database.all(`
        SELECT customer_name,
          SUM(quantity) as volume,
          ROUND(SUM(COALESCE(amount,0)),0) as revenue,
          ROUND(SUM(COALESCE(balance,0)),0) as outstanding,
          COUNT(*) as orders,
          MAX(date) as last_delivery
        FROM sales ${dateFilter}
        GROUP BY customer_name ORDER BY revenue DESC LIMIT 15
      `),
      database.all(`
        SELECT COALESCE(payment_mode,'Unknown') as payment_mode,
          ROUND(SUM(COALESCE(amount,0)),0) as total, COUNT(*) as count
        FROM sales ${dateFilter}
        GROUP BY payment_mode ORDER BY total DESC
      `),
      database.get(`
        SELECT
          ROUND(SUM(CASE WHEN julianday('now')-julianday(date)<=15 THEN balance ELSE 0 END),0) as d0_15,
          ROUND(SUM(CASE WHEN julianday('now')-julianday(date) BETWEEN 16 AND 30 THEN balance ELSE 0 END),0) as d16_30,
          ROUND(SUM(CASE WHEN julianday('now')-julianday(date) BETWEEN 31 AND 60 THEN balance ELSE 0 END),0) as d31_60,
          ROUND(SUM(CASE WHEN julianday('now')-julianday(date) BETWEEN 61 AND 90 THEN balance ELSE 0 END),0) as d61_90,
          ROUND(SUM(CASE WHEN julianday('now')-julianday(date)>90 THEN balance ELSE 0 END),0) as d90plus
        FROM sales WHERE status != 'CLOSED' AND balance > 0
      `),
      database.get(`
        SELECT
          SUM(quantity) as total_volume,
          ROUND(SUM(COALESCE(amount,0)),0) as total_revenue,
          ROUND(SUM(COALESCE(balance,0)),0) as total_outstanding,
          COUNT(*) as total_orders,
          COUNT(DISTINCT customer_name) as total_customers,
          MIN(date) as first_date, MAX(date) as last_date
        FROM sales ${dateFilter}
      `),
      database.all(`
        SELECT strftime('%Y-%m', date) as ym, ROUND(SUM(amount),0) as collected
        FROM payments ${from && to ? `WHERE date BETWEEN '${from}' AND '${to}'` : ''}
        GROUP BY ym ORDER BY ym ASC
      `),
    ]);

  const collMap: Record<string, number> = {};
  (collectionByMonth as { ym: string; collected: number }[]).forEach(r => { collMap[r.ym] = r.collected; });

  const monthlyWithCollection = (monthly as {
    month_label: string; first_date: string; volume: number;
    revenue: number; outstanding: number; orders: number; customers: number;
  }[]).map(m => ({
    ...m,
    collected: collMap[m.first_date?.slice(0, 7)] ?? 0,
    collection_rate: m.revenue > 0
      ? Math.round(((m.revenue - m.outstanding) / m.revenue) * 100) : 0,
  }));

  return NextResponse.json({
    stats: totalStats,
    monthly: monthlyWithCollection,
    sizes: sizeBreakdown,
    top_customers: topCustomers,
    payment_modes: paymentModes,
    ageing,
  });
}
