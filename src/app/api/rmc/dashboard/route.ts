import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const database = db();
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date()
    .toLocaleString('en', { month: 'short', year: '2-digit' })
    .toUpperCase().replace(' ', '-');

  const [todayRow, monthRow, outstandingRow, gradeRow, monthlySummary] = await Promise.all([
    database.get(
      `SELECT ROUND(SUM(quantity),1) as volume FROM rmc_sales WHERE date = ?`,
      today
    ),
    database.get(
      `SELECT ROUND(SUM(quantity),1) as volume, ROUND(SUM(COALESCE(total_amount,0)),2) as amount
       FROM rmc_sales WHERE month_label = ?`,
      currentMonth
    ),
    database.get(
      `SELECT ROUND(SUM(COALESCE(balance,0)),2) as amount, COUNT(*) as cnt
       FROM rmc_sales WHERE status != 'CLOSED'`
    ),
    database.get(
      `SELECT
        ROUND(SUM(CASE WHEN grade='M10' THEN quantity ELSE 0 END),1) as M10,
        ROUND(SUM(CASE WHEN grade='M15' THEN quantity ELSE 0 END),1) as M15,
        ROUND(SUM(CASE WHEN grade='M20' THEN quantity ELSE 0 END),1) as M20,
        ROUND(SUM(CASE WHEN grade='M25' THEN quantity ELSE 0 END),1) as M25,
        ROUND(SUM(CASE WHEN grade='M30' THEN quantity ELSE 0 END),1) as M30,
        ROUND(SUM(CASE WHEN grade='M35' THEN quantity ELSE 0 END),1) as M35,
        ROUND(SUM(CASE WHEN grade='M40' THEN quantity ELSE 0 END),1) as M40,
        ROUND(SUM(CASE WHEN grade NOT IN ('M10','M15','M20','M25','M30','M35','M40') AND grade IS NOT NULL AND grade != '' THEN quantity ELSE 0 END),1) as Other
       FROM rmc_sales`
    ),
    database.all(
      `SELECT month_label,
        ROUND(SUM(quantity),1) as volume,
        ROUND(SUM(COALESCE(total_amount,0)),2) as amount,
        COUNT(*) as orders
       FROM rmc_sales
       GROUP BY month_label ORDER BY MIN(date) DESC LIMIT 6`
    ),
  ]);

  return NextResponse.json({
    today_volume:       Number(todayRow?.volume ?? 0),
    month_volume:       Number(monthRow?.volume ?? 0),
    month_amount:       Number(monthRow?.amount ?? 0),
    outstanding_amount: Number(outstandingRow?.amount ?? 0),
    outstanding_count:  Number(outstandingRow?.cnt ?? 0),
    grade_breakdown:    gradeRow ?? { M10: 0, M15: 0, M20: 0, M25: 0, M30: 0, M35: 0, M40: 0, Other: 0 },
    monthly_summary:    monthlySummary.reverse(),
  });
}
