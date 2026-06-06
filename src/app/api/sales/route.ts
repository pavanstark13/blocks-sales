import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month     = searchParams.get('month');
  const status    = searchParams.get('status');
  const search    = searchParams.get('search') || searchParams.get('customer');
  const dateFrom  = searchParams.get('date_from');
  const dateTo    = searchParams.get('date_to');
  const page      = parseInt(searchParams.get('page')  || '1');
  const limit     = parseInt(searchParams.get('limit') || '50');
  const offset    = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (month)    { where += ' AND month_label = ?'; params.push(month); }
  if (status)   { where += ' AND status = ?';      params.push(status); }
  if (dateFrom) { where += ' AND date >= ?';        params.push(dateFrom); }
  if (dateTo)   { where += ' AND date <= ?';        params.push(dateTo); }
  if (search) {
    where += ' AND (customer_name LIKE ? OR address LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const database = db();
  const countRow = await database.get(`SELECT COUNT(*) as cnt FROM sales ${where}`, ...params);
  const total = Number(countRow?.cnt ?? 0);
  const rows  = await database.all(
    `SELECT * FROM sales ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset
  );

  return NextResponse.json({ data: rows, total, page, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, customer_name, address, phone, size, quantity, rate, advance, status, payment_mode, notes, vehicle_no } = body;

  if (!date || !size || !quantity) {
    return NextResponse.json({ error: 'date, size, and quantity are required' }, { status: 400 });
  }

  const amount  = rate && quantity ? Math.round(rate * quantity * 100) / 100 : null;
  const balance = amount != null && advance != null ? Math.max(0, amount - advance) : amount;
  const month_label = new Date(date)
    .toLocaleString('en', { month: 'short', year: '2-digit' })
    .toUpperCase().replace(' ', '-');

  const result = await db().run(
    `INSERT INTO sales (date, customer_name, address, phone, size, quantity, rate, amount, advance, balance, status, payment_mode, notes, month_label, vehicle_no)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    date, customer_name || null, address || null, phone || null,
    size, quantity, rate || null, amount, advance || 0, balance,
    status || 'CLOSED', payment_mode || null, notes || null, month_label, vehicle_no || null
  );

  return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
}
