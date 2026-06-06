import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const status = searchParams.get('status');
  const customer = searchParams.get('customer');

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (dateFrom)  { where += ' AND date >= ?';           params.push(dateFrom); }
  if (dateTo)    { where += ' AND date <= ?';            params.push(dateTo); }
  if (status)    { where += ' AND status = ?';           params.push(status); }
  if (customer)  { where += ' AND customer_name LIKE ?'; params.push(`%${customer}%`); }

  const rows = await db().all(
    `SELECT * FROM rmc_cube_tests ${where} ORDER BY date DESC, id DESC`,
    ...params
  );

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    date, customer_name, site_address, grade, batch_date, quantity,
    sample_count, result_7day, result_28day, required_strength, status, notes, sale_id,
  } = body;

  if (!date || !grade) {
    return NextResponse.json({ error: 'date and grade are required' }, { status: 400 });
  }

  const result = await db().run(
    `INSERT INTO rmc_cube_tests
       (sale_id, date, customer_name, site_address, grade, batch_date, quantity, sample_count,
        result_7day, result_28day, required_strength, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sale_id ?? null,
    date,
    customer_name ?? null,
    site_address ?? null,
    grade,
    batch_date ?? null,
    quantity ?? null,
    sample_count ?? 3,
    result_7day ?? null,
    result_28day ?? null,
    required_strength ?? null,
    status ?? 'PENDING',
    notes ?? null,
  );

  return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, result_7day, result_28day, required_strength, status, notes, ...rest } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Build dynamic update
  const fields: string[] = [];
  const params: unknown[] = [];

  const updates: Record<string, unknown> = { result_7day, result_28day, required_strength, status, notes, ...rest };
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      params.push(val);
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  params.push(id);
  await db().run(
    `UPDATE rmc_cube_tests SET ${fields.join(', ')} WHERE id = ?`,
    ...params
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await db().run('DELETE FROM rmc_cube_tests WHERE id = ?', id);
  return NextResponse.json({ ok: true });
}
