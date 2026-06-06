import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const module = searchParams.get('module');
  const customerName = searchParams.get('customer_name');

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (module) { where += ' AND module = ?'; params.push(module); }
  if (customerName) { where += ' AND customer_name = ?'; params.push(customerName); }

  const rows = await db().all(
    `SELECT * FROM customer_credit_limits ${where} ORDER BY customer_name`,
    ...params
  );

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customer_name, module, credit_limit, notes } = body;

  if (!customer_name || !module || credit_limit == null) {
    return NextResponse.json({ error: 'customer_name, module, and credit_limit are required' }, { status: 400 });
  }

  await db().run(
    `INSERT INTO customer_credit_limits (customer_name, module, credit_limit, notes)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(customer_name) DO UPDATE SET
       module = excluded.module,
       credit_limit = excluded.credit_limit,
       notes = excluded.notes`,
    customer_name, module, credit_limit, notes ?? null
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customerName = searchParams.get('customer_name');
  const module = searchParams.get('module');

  if (!customerName || !module) {
    return NextResponse.json({ error: 'customer_name and module are required' }, { status: 400 });
  }

  await db().run(
    'DELETE FROM customer_credit_limits WHERE customer_name = ? AND module = ?',
    customerName, module
  );

  return NextResponse.json({ ok: true });
}
