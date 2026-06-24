import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  const database = db();
  const w  = from && to ? `WHERE date BETWEEN '${from}' AND '${to}'` : '';
  const wp = from && to ? `WHERE date BETWEEN '${from}' AND '${to}'` : '';

  const [
    monthly,
    sizeBreakdown,
    topCustomers,
    paymentModes,
    ageing,
    totalStats,
    collectionByMonth,
    customerFrequency,
    dsoData,
  ] = await Promise.all([

    // Monthly with per-size breakdown
    database.all(`
      SELECT
        month_label,
        MIN(date) as first_date,
        MAX(date) as last_date,
        COUNT(*) as orders,
        COUNT(DISTINCT customer_name) as customers,
        ROUND(SUM(quantity),0) as total_qty,
        ROUND(SUM(COALESCE(amount,0)),0) as revenue,
        ROUND(SUM(COALESCE(balance,0)),0) as outstanding,
        ROUND(SUM(CASE WHEN size=4 THEN quantity ELSE 0 END),0) as qty_4,
        ROUND(SUM(CASE WHEN size=6 THEN quantity ELSE 0 END),0) as qty_6,
        ROUND(SUM(CASE WHEN size=8 THEN quantity ELSE 0 END),0) as qty_8,
        ROUND(SUM(CASE WHEN size=4 THEN COALESCE(amount,0) ELSE 0 END),0) as rev_4,
        ROUND(SUM(CASE WHEN size=6 THEN COALESCE(amount,0) ELSE 0 END),0) as rev_6,
        ROUND(SUM(CASE WHEN size=8 THEN COALESCE(amount,0) ELSE 0 END),0) as rev_8
      FROM sales ${w}
      GROUP BY month_label ORDER BY MIN(date) ASC
    `),

    // Overall size breakdown
    database.all(`
      SELECT size,
        ROUND(SUM(quantity),0) as volume,
        ROUND(SUM(COALESCE(amount,0)),0) as revenue,
        COUNT(*) as orders,
        ROUND(AVG(NULLIF(rate,0)),0) as avg_rate,
        COUNT(DISTINCT customer_name) as customers
      FROM sales ${w}
      GROUP BY size ORDER BY size ASC
    `),

    // Top 15 customers with size breakdown
    database.all(`
      SELECT customer_name,
        ROUND(SUM(quantity),0) as volume,
        ROUND(SUM(COALESCE(amount,0)),0) as revenue,
        ROUND(SUM(COALESCE(balance,0)),0) as outstanding,
        COUNT(*) as orders,
        COUNT(DISTINCT strftime('%Y-%m', date)) as active_months,
        MAX(date) as last_delivery,
        ROUND(SUM(CASE WHEN size=4 THEN quantity ELSE 0 END),0) as qty_4,
        ROUND(SUM(CASE WHEN size=6 THEN quantity ELSE 0 END),0) as qty_6,
        ROUND(SUM(CASE WHEN size=8 THEN quantity ELSE 0 END),0) as qty_8
      FROM sales ${w}
      WHERE customer_name IS NOT NULL
      GROUP BY customer_name ORDER BY revenue DESC LIMIT 15
    `),

    // Payment modes
    database.all(`
      SELECT COALESCE(payment_mode,'Unknown') as payment_mode,
        ROUND(SUM(COALESCE(amount,0)),0) as total, COUNT(*) as count
      FROM sales ${w}
      GROUP BY payment_mode ORDER BY total DESC
    `),

    // Ageing buckets on open orders
    database.get(`
      SELECT
        ROUND(SUM(CASE WHEN julianday('now')-julianday(date)<=15 THEN balance ELSE 0 END),0) as d0_15,
        ROUND(SUM(CASE WHEN julianday('now')-julianday(date) BETWEEN 16 AND 30 THEN balance ELSE 0 END),0) as d16_30,
        ROUND(SUM(CASE WHEN julianday('now')-julianday(date) BETWEEN 31 AND 60 THEN balance ELSE 0 END),0) as d31_60,
        ROUND(SUM(CASE WHEN julianday('now')-julianday(date) BETWEEN 61 AND 90 THEN balance ELSE 0 END),0) as d61_90,
        ROUND(SUM(CASE WHEN julianday('now')-julianday(date)>90 THEN balance ELSE 0 END),0) as d90plus,
        COUNT(DISTINCT CASE WHEN balance>0 THEN customer_name END) as customers_with_due
      FROM sales WHERE status != 'CLOSED' AND balance > 0
    `),

    // Overall totals
    database.get(`
      SELECT
        ROUND(SUM(quantity),0) as total_volume,
        ROUND(SUM(COALESCE(amount,0)),0) as total_revenue,
        ROUND(SUM(COALESCE(balance,0)),0) as total_outstanding,
        COUNT(*) as total_orders,
        COUNT(DISTINCT customer_name) as total_customers,
        MIN(date) as first_date, MAX(date) as last_date,
        ROUND(AVG(COALESCE(amount,0)),0) as avg_order_value,
        ROUND(SUM(CASE WHEN size=4 THEN quantity ELSE 0 END),0) as total_qty_4,
        ROUND(SUM(CASE WHEN size=6 THEN quantity ELSE 0 END),0) as total_qty_6,
        ROUND(SUM(CASE WHEN size=8 THEN quantity ELSE 0 END),0) as total_qty_8
      FROM sales ${w}
    `),

    // Collections by month
    database.all(`
      SELECT strftime('%Y-%m', date) as ym, ROUND(SUM(amount),0) as collected
      FROM payments ${wp}
      GROUP BY ym ORDER BY ym ASC
    `),

    // Customer order frequency (orders per active month)
    database.all(`
      SELECT customer_name,
        COUNT(*) as total_orders,
        COUNT(DISTINCT strftime('%Y-%m', date)) as active_months,
        MAX(date) as last_order,
        ROUND(julianday('now') - julianday(MAX(date))) as days_since_last
      FROM sales ${w}
      WHERE customer_name IS NOT NULL
      GROUP BY customer_name
      ORDER BY last_order DESC
    `),

    // DSO data: avg days to collect (approx)
    database.get(`
      SELECT
        ROUND(AVG(julianday('now') - julianday(date)), 0) as avg_invoice_age,
        ROUND(SUM(COALESCE(balance,0)) * 30.0 / NULLIF(SUM(COALESCE(amount,0))/12.0, 0), 0) as dso_estimate
      FROM sales WHERE status != 'CLOSED' AND balance > 0
    `),
  ]);

  // Add collection data to monthly
  const collMap: Record<string, number> = {};
  (collectionByMonth as { ym: string; collected: number }[]).forEach(r => { collMap[r.ym] = r.collected; });

  type MonthRaw = {
    month_label: string; first_date: string; last_date: string;
    orders: number; customers: number; total_qty: number;
    revenue: number; outstanding: number;
    qty_4: number; qty_6: number; qty_8: number;
    rev_4: number; rev_6: number; rev_8: number;
  };

  const monthlyEnriched = (monthly as MonthRaw[]).map((m, idx, arr) => {
    const prev = idx > 0 ? arr[idx - 1] : null;
    const collected = collMap[m.first_date?.slice(0, 7)] ?? 0;
    const collection_rate = m.revenue > 0
      ? Math.round(((m.revenue - m.outstanding) / m.revenue) * 100) : 0;
    const aov = m.orders > 0 ? Math.round(m.revenue / m.orders) : 0;
    const mom_revenue = prev && prev.revenue > 0
      ? Math.round(((m.revenue - prev.revenue) / prev.revenue) * 100) : null;
    const mom_volume = prev && prev.total_qty > 0
      ? Math.round(((m.total_qty - prev.total_qty) / prev.total_qty) * 100) : null;
    const mom_qty4 = prev && prev.qty_4 > 0
      ? Math.round(((m.qty_4 - prev.qty_4) / prev.qty_4) * 100) : null;
    const mom_qty6 = prev && prev.qty_6 > 0
      ? Math.round(((m.qty_6 - prev.qty_6) / prev.qty_6) * 100) : null;
    const mom_qty8 = prev && prev.qty_8 > 0
      ? Math.round(((m.qty_8 - prev.qty_8) / prev.qty_8) * 100) : null;
    return {
      ...m, collected, collection_rate, aov,
      mom_revenue, mom_volume, mom_qty4, mom_qty6, mom_qty8,
    };
  });

  // Customer concentration (Pareto)
  const custList = topCustomers as { revenue: number; customer_name: string }[];
  const totalRev = (totalStats as { total_revenue: number })?.total_revenue ?? 0;
  const top5rev = custList.slice(0, 5).reduce((s, c) => s + c.revenue, 0);
  const top3rev = custList.slice(0, 3).reduce((s, c) => s + c.revenue, 0);
  const concentration = {
    top3_pct: totalRev > 0 ? Math.round((top3rev / totalRev) * 100) : 0,
    top5_pct: totalRev > 0 ? Math.round((top5rev / totalRev) * 100) : 0,
  };

  // Inactive customers (no order in last 60 days)
  const freqList = customerFrequency as { customer_name: string; days_since_last: number; total_orders: number }[];
  const inactive = freqList.filter(c => c.days_since_last > 60).length;
  const atRisk = freqList.filter(c => c.days_since_last > 30 && c.days_since_last <= 60).length;

  return NextResponse.json({
    stats: totalStats,
    monthly: monthlyEnriched,
    sizes: sizeBreakdown,
    top_customers: topCustomers,
    payment_modes: paymentModes,
    ageing,
    concentration,
    customer_health: { inactive, at_risk: atRisk, total: freqList.length },
    dso: dsoData,
  });
}
