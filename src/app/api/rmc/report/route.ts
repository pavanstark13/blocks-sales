import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from'); // e.g. 2025-08-01
  const to   = searchParams.get('to');   // e.g. 2026-06-30

  const database = db();

  const dateFilter = from && to
    ? `WHERE s.date BETWEEN '${from}' AND '${to}'`
    : '';
  const dateFilterPlain = from && to
    ? `WHERE date BETWEEN '${from}' AND '${to}'`
    : '';

  const [
    monthly,
    gradeBreakdown,
    topCustomers,
    paymentModes,
    collectionByMonth,
    ageing,
    totalStats,
  ] = await Promise.all([
    // Monthly revenue + volume + orders
    database.all(`
      SELECT
        month_label,
        MIN(date) as first_date,
        ROUND(SUM(quantity), 1) as volume,
        ROUND(SUM(COALESCE(total_amount, 0)), 0) as revenue,
        ROUND(SUM(COALESCE(balance, 0)), 0) as outstanding,
        COUNT(*) as orders,
        COUNT(DISTINCT customer_name) as customers
      FROM rmc_sales s
      ${dateFilterPlain}
      GROUP BY month_label
      ORDER BY MIN(date) ASC
    `),

    // Grade mix (volume + revenue)
    database.all(`
      SELECT
        grade,
        ROUND(SUM(quantity), 1) as volume,
        ROUND(SUM(COALESCE(total_amount, 0)), 0) as revenue,
        COUNT(*) as orders
      FROM rmc_sales s
      ${dateFilterPlain}
      GROUP BY grade
      ORDER BY volume DESC
    `),

    // Top 15 customers by revenue
    database.all(`
      SELECT
        customer_name,
        ROUND(SUM(quantity), 1) as volume,
        ROUND(SUM(COALESCE(total_amount, 0)), 0) as revenue,
        ROUND(SUM(COALESCE(balance, 0)), 0) as outstanding,
        COUNT(*) as orders,
        COUNT(DISTINCT grade) as grades_used,
        MAX(date) as last_delivery
      FROM rmc_sales s
      ${dateFilterPlain}
      GROUP BY customer_name
      ORDER BY revenue DESC
      LIMIT 15
    `),

    // Payment mode split
    database.all(`
      SELECT
        payment_mode,
        ROUND(SUM(amount), 0) as total,
        COUNT(*) as count
      FROM rmc_payments
      ${from && to ? `WHERE date BETWEEN '${from}' AND '${to}'` : ''}
      GROUP BY payment_mode
      ORDER BY total DESC
    `),

    // Collections by month (payments received)
    database.all(`
      SELECT
        strftime('%Y-%m', date) as ym,
        ROUND(SUM(amount), 0) as collected
      FROM rmc_payments
      ${from && to ? `WHERE date BETWEEN '${from}' AND '${to}'` : ''}
      GROUP BY ym
      ORDER BY ym ASC
    `),

    // Ageing buckets
    database.get(`
      SELECT
        ROUND(SUM(CASE WHEN julianday('now') - julianday(date) <= 15 THEN balance ELSE 0 END), 0) as d0_15,
        ROUND(SUM(CASE WHEN julianday('now') - julianday(date) BETWEEN 16 AND 30 THEN balance ELSE 0 END), 0) as d16_30,
        ROUND(SUM(CASE WHEN julianday('now') - julianday(date) BETWEEN 31 AND 60 THEN balance ELSE 0 END), 0) as d31_60,
        ROUND(SUM(CASE WHEN julianday('now') - julianday(date) BETWEEN 61 AND 90 THEN balance ELSE 0 END), 0) as d61_90,
        ROUND(SUM(CASE WHEN julianday('now') - julianday(date) > 90 THEN balance ELSE 0 END), 0) as d90plus
      FROM rmc_sales
      WHERE status != 'CLOSED' AND balance > 0
    `),

    // Overall totals
    database.get(`
      SELECT
        ROUND(SUM(quantity), 1) as total_volume,
        ROUND(SUM(COALESCE(total_amount, 0)), 0) as total_revenue,
        ROUND(SUM(COALESCE(balance, 0)), 0) as total_outstanding,
        COUNT(*) as total_orders,
        COUNT(DISTINCT customer_name) as total_customers,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM rmc_sales s
      ${dateFilterPlain}
    `),
  ]);

  // Calculate collection rate per month
  const collMap: Record<string, number> = {};
  (collectionByMonth as { ym: string; collected: number }[]).forEach(r => {
    collMap[r.ym] = r.collected;
  });

  const monthlyWithCollection = (monthly as {
    month_label: string; first_date: string; volume: number;
    revenue: number; outstanding: number; orders: number; customers: number;
  }[]).map(m => ({
    ...m,
    collected: collMap[m.first_date?.slice(0, 7)] ?? 0,
    collection_rate: m.revenue > 0
      ? Math.round(((m.revenue - m.outstanding) / m.revenue) * 100)
      : 0,
  }));

  return NextResponse.json({
    stats: totalStats,
    monthly: monthlyWithCollection,
    grades: gradeBreakdown,
    top_customers: topCustomers,
    payment_modes: paymentModes,
    ageing,
  });
}
