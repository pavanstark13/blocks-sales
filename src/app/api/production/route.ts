import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/production?date_from=&date_to=
// Returns entries + stock summary (produced - dispatched per size)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo   = searchParams.get('date_to');
  const database = db();

  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  if (dateFrom) { where += ' AND date >= ?'; params.push(dateFrom); }
  if (dateTo)   { where += ' AND date <= ?'; params.push(dateTo); }

  const entries = await database.all(
    `SELECT id, date, size, quantity, notes FROM production ${where} ORDER BY date DESC, id DESC`,
    ...params
  );

  // Stock = total produced (all time) - total dispatched (sales, all time)
  const stockRows = await database.all(`
    SELECT size,
      COALESCE((SELECT SUM(quantity) FROM production p WHERE p.size = s.size), 0) as produced,
      COALESCE((SELECT SUM(quantity) FROM sales     sl WHERE sl.size = s.size), 0) as dispatched
    FROM (SELECT DISTINCT size FROM production UNION SELECT DISTINCT size FROM sales) s
    ORDER BY size
  `);

  const stock = stockRows.map(r => ({
    size: Number(r.size),
    produced:   Number(r.produced),
    dispatched: Number(r.dispatched),
    available:  Number(r.produced) - Number(r.dispatched),
  }));

  // Production summary by date for the filtered range
  const summary = await database.all(`
    SELECT date, SUM(CASE WHEN size=4 THEN quantity ELSE 0 END) as qty_4,
                 SUM(CASE WHEN size=6 THEN quantity ELSE 0 END) as qty_6,
                 SUM(CASE WHEN size=8 THEN quantity ELSE 0 END) as qty_8,
                 SUM(quantity) as total
    FROM production ${where} GROUP BY date ORDER BY date DESC`,
    ...params
  );

  return NextResponse.json({ entries, stock, summary });
}

// POST /api/production  { date, size, quantity, notes? }
export async function POST(req: NextRequest) {
  const { date, size, quantity, notes } = await req.json();
  if (!date || !size || !quantity) {
    return NextResponse.json({ error: 'date, size, quantity required' }, { status: 400 });
  }
  const result = await db().run(
    `INSERT INTO production (date, size, quantity, notes) VALUES (?, ?, ?, ?)`,
    date, size, quantity, notes || null
  );
  return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
}

// DELETE /api/production?id=123
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await db().run(`DELETE FROM production WHERE id = ?`, id);
  return NextResponse.json({ ok: true });
}
