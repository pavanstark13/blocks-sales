import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month    = searchParams.get('month');
  const status   = searchParams.get('status');
  const search   = searchParams.get('search');
  const dateFrom = searchParams.get('date_from');
  const dateTo   = searchParams.get('date_to');
  const grade    = searchParams.get('grade');

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (month)    { where += ' AND month_label = ?'; params.push(month); }
  if (status)   { where += ' AND status = ?';      params.push(status); }
  if (grade)    { where += ' AND grade = ?';        params.push(grade); }
  if (dateFrom) { where += ' AND date >= ?';        params.push(dateFrom); }
  if (dateTo)   { where += ' AND date <= ?';        params.push(dateTo); }
  if (search) {
    where += ' AND (customer_name LIKE ? OR site_address LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const rows = await db().all(
    `SELECT date, customer_name, site_address, grade, quantity, rate, amount, pump_charge, total_amount, advance, balance, status, payment_mode, notes, month_label
     FROM rmc_sales ${where} ORDER BY date DESC, id DESC`,
    ...params
  );

  const csv = toCSV(
    ['Date','Customer','Site Address','Grade','Qty (m³)','Rate','Amount','Pump Charge','Total Amount','Advance','Balance','Status','Payment Mode','Notes','Month'],
    rows,
    ['date','customer_name','site_address','grade','quantity','rate','amount','pump_charge','total_amount','advance','balance','status','payment_mode','notes','month_label']
  );
  const filename = month ? `rmc-sales-${month}.csv` : 'rmc-sales-all.csv';
  return csvResponse(csv, filename);
}

function toCSV(headers: string[], rows: Record<string, unknown>[], keys: string[]) {
  const escape = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(keys.map(k => escape(row[k])).join(','));
  return lines.join('\n');
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
