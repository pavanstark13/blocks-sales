import { NextRequest, NextResponse } from 'next/server';
import { db, DB } from '@/lib/db';

function monthLabel(date: string): string {
  const [year, month] = date.split('-').map(Number);
  const names = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${names[month - 1]}-${String(year).slice(2)}`;
}

async function rebalance(database: DB) {
  const all = await database.all(
    `SELECT id, entry_type, bags, bags_consumed FROM blocks_cement ORDER BY date ASC, id ASC`
  );
  let balance = 0;
  for (const r of all) {
    if (r.entry_type === 'INWARD') {
      balance += Number(r.bags) || 0;
    } else {
      balance -= Number(r.bags_consumed) || 0;
    }
    await database.run(
      `UPDATE blocks_cement SET balance_bags = ? WHERE id = ?`,
      Math.max(0, balance), r.id
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const type = searchParams.get('type');

  const database = db();

  let sql = `SELECT * FROM blocks_cement`;
  const params: string[] = [];
  const conditions: string[] = [];

  if (month) { conditions.push(`month_label = ?`); params.push(month); }
  if (type) { conditions.push(`entry_type = ?`); params.push(type.toUpperCase()); }
  if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
  sql += ` ORDER BY date ASC, id ASC`;

  const rows = await database.all(sql, ...params);
  return NextResponse.json({ rows, total: rows.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    date, entry_type, supplier, vehicle_no,
    bags = 0, price_per_bag = 0,
    bags_consumed = 0, consumption_note, notes,
  } = body;

  if (!date || !entry_type) {
    return NextResponse.json({ error: 'date and entry_type required' }, { status: 400 });
  }

  const total_cost = (Number(bags) || 0) * (Number(price_per_bag) || 0);
  const database = db();

  await database.run(
    `INSERT INTO blocks_cement (date, month_label, entry_type, supplier, vehicle_no,
      bags, price_per_bag, total_cost, bags_consumed, consumption_note, balance_bags, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    date, monthLabel(date), entry_type.toUpperCase(),
    supplier || null, vehicle_no || null,
    Number(bags) || 0, Number(price_per_bag) || 0, total_cost,
    Number(bags_consumed) || 0, consumption_note || null, notes || null,
  );

  await rebalance(database);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const {
    id, date, entry_type, supplier, vehicle_no,
    bags = 0, price_per_bag = 0,
    bags_consumed = 0, consumption_note, notes,
  } = body;

  if (!id || !date || !entry_type) {
    return NextResponse.json({ error: 'id, date and entry_type required' }, { status: 400 });
  }

  const total_cost = (Number(bags) || 0) * (Number(price_per_bag) || 0);
  const database = db();

  await database.run(
    `UPDATE blocks_cement SET date = ?, month_label = ?, entry_type = ?, supplier = ?, vehicle_no = ?,
      bags = ?, price_per_bag = ?, total_cost = ?, bags_consumed = ?, consumption_note = ?, notes = ?
     WHERE id = ?`,
    date, monthLabel(date), entry_type.toUpperCase(),
    supplier || null, vehicle_no || null,
    Number(bags) || 0, Number(price_per_bag) || 0, total_cost,
    Number(bags_consumed) || 0, consumption_note || null, notes || null,
    id
  );

  await rebalance(database);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const database = db();
  await database.run(`DELETE FROM blocks_cement WHERE id = ?`, id);
  await rebalance(database);
  return NextResponse.json({ ok: true });
}
