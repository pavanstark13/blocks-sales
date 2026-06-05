import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ['date', 'customer_name', 'address', 'phone', 'size', 'quantity', 'rate', 'amount', 'advance', 'balance', 'status', 'payment_mode', 'notes'];
  const fields = Object.keys(body).filter(k => allowed.includes(k));
  if (!fields.length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  // Recompute amount/balance if rate or quantity changed
  const existing = db().prepare('SELECT * FROM sales WHERE id = ?').get(id) as Record<string, unknown>;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const merged = { ...existing, ...body };
  if (merged.rate && merged.quantity) {
    merged.amount = Math.round(Number(merged.rate) * Number(merged.quantity) * 100) / 100;
  }
  if (merged.amount != null) {
    merged.balance = Math.max(0, Number(merged.amount) - Number(merged.advance || 0));
  }

  const setClause = ['rate', 'quantity', 'amount', 'advance', 'balance', ...fields.filter(f => !['rate','quantity','amount','advance','balance'].includes(f))]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(f => `${f} = ?`).join(', ');
  const values = ['rate', 'quantity', 'amount', 'advance', 'balance', ...fields.filter(f => !['rate','quantity','amount','advance','balance'].includes(f))]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(f => merged[f] ?? null);

  db().prepare(`UPDATE sales SET ${setClause} WHERE id = ?`).run(...values, id);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db().prepare('DELETE FROM sales WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
