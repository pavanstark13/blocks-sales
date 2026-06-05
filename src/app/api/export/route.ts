import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month    = searchParams.get('month');
  const status   = searchParams.get('status');
  const search   = searchParams.get('search');
  const type     = searchParams.get('type') || 'sales'; // sales | summary | customer

  const database = db();

  if (type === 'summary') {
    const rows = await database.all(`
      SELECT month_label,
        COUNT(*) as orders, SUM(quantity) as total_blocks,
        SUM(CASE WHEN size=4 THEN quantity ELSE 0 END) as blocks_4,
        SUM(CASE WHEN size=6 THEN quantity ELSE 0 END) as blocks_6,
        SUM(CASE WHEN size=8 THEN quantity ELSE 0 END) as blocks_8,
        ROUND(SUM(COALESCE(amount,0)),2) as revenue,
        ROUND(SUM(COALESCE(advance,0)),2) as received,
        ROUND(SUM(COALESCE(balance,0)),2) as outstanding,
        COUNT(CASE WHEN status='OPEN' THEN 1 END) as open_orders
      FROM sales GROUP BY month_label ORDER BY MIN(date)
    `);
    const csv = toCSV(['Month','Orders','Total Blocks','4" Blocks','6" Blocks','8" Blocks','Revenue','Received','Outstanding','Open Orders'], rows,
      ['month_label','orders','total_blocks','blocks_4','blocks_6','blocks_8','revenue','received','outstanding','open_orders']);
    return csvResponse(csv, 'monthly-summary.csv');
  }

  if (type === 'customer') {
    const rows = await database.all(`
      SELECT customer_name, MAX(address) as address, MAX(phone) as phone,
        COUNT(*) as orders, SUM(quantity) as total_qty,
        ROUND(SUM(COALESCE(amount,0)),2) as total_amount,
        ROUND(SUM(COALESCE(balance,0)),2) as outstanding,
        MAX(date) as last_order
      FROM sales WHERE customer_name IS NOT NULL
      GROUP BY customer_name ORDER BY total_amount DESC
    `);
    const csv = toCSV(['Customer','Address','Phone','Orders','Total Blocks','Total Amount','Outstanding','Last Order'], rows,
      ['customer_name','address','phone','orders','total_qty','total_amount','outstanding','last_order']);
    return csvResponse(csv, 'customers.csv');
  }

  // Sales export (default)
  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  if (month)  { where += ' AND month_label = ?'; params.push(month); }
  if (status) { where += ' AND status = ?';      params.push(status); }
  if (search) {
    where += ' AND (customer_name LIKE ? OR address LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const rows = await database.all(
    `SELECT date, customer_name, address, phone, size, quantity, rate, amount, advance, balance, status, payment_mode, notes, month_label
     FROM sales ${where} ORDER BY date DESC, id DESC`,
    ...params
  );

  const csv = toCSV(
    ['Date','Customer','Address','Phone','Size (inch)','Quantity','Rate','Amount','Advance','Balance','Status','Payment Mode','Notes','Month'],
    rows,
    ['date','customer_name','address','phone','size','quantity','rate','amount','advance','balance','status','payment_mode','notes','month_label']
  );
  const filename = month ? `sales-${month}.csv` : 'sales-all.csv';
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
