import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month    = searchParams.get('month');
  const status   = searchParams.get('status');
  const search   = searchParams.get('search') || searchParams.get('customer');
  const dateFrom = searchParams.get('date_from');
  const dateTo   = searchParams.get('date_to');
  const grade    = searchParams.get('grade');
  const page     = parseInt(searchParams.get('page')  || '1');
  const limit    = parseInt(searchParams.get('limit') || '50');
  const offset   = (page - 1) * limit;

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

  const database = db();
  const countRow = await database.get(`SELECT COUNT(*) as cnt FROM rmc_sales ${where}`, ...params);
  const total = Number(countRow?.cnt ?? 0);
  const rows  = await database.all(
    `SELECT * FROM rmc_sales ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset
  );

  return NextResponse.json({ data: rows, total, page, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, customer_name, site_address, grade, quantity, rate, pump_charge, advance, status, payment_mode, notes } = body;

  if (!date || !grade || !quantity) {
    return NextResponse.json({ error: 'date, grade, and quantity are required' }, { status: 400 });
  }

  const qty = parseFloat(quantity);
  const r   = rate ? parseFloat(rate) : null;
  const pc  = parseFloat(pump_charge || '0') || 0;
  const adv = parseFloat(advance || '0') || 0;

  const amount       = r != null ? Math.round(r * qty * 100) / 100 : null;
  const total_amount = amount != null ? Math.round((amount + pc) * 100) / 100 : pc > 0 ? pc : null;
  const balance      = total_amount != null ? Math.max(0, total_amount - adv) : null;

  const month_label = new Date(date)
    .toLocaleString('en', { month: 'short', year: '2-digit' })
    .toUpperCase().replace(' ', '-');

  const result = await db().run(
    `INSERT INTO rmc_sales (date, customer_name, site_address, grade, quantity, rate, amount, pump_charge, total_amount, advance, balance, status, payment_mode, notes, month_label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    date, customer_name || null, site_address || null,
    grade, qty, r, amount, pc, total_amount, adv, balance,
    status || 'CLOSED', payment_mode || null, notes || null, month_label
  );

  return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
}
