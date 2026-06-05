import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const allowed = ['date','customer_name','address','phone','size','quantity','rate','amount','advance','balance','status','payment_mode','notes'];
  const fields  = Object.keys(body).filter(k => allowed.includes(k));
  if (!fields.length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  const existing = await db().get('SELECT * FROM sales WHERE id = ?', id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const merged: Record<string, unknown> = { ...existing, ...body };

  if (merged.rate && merged.quantity) {
    merged.amount = Math.round(Number(merged.rate) * Number(merged.quantity) * 100) / 100;
  }
  if (merged.amount != null) {
    merged.balance = Math.max(0, Number(merged.amount) - Number(merged.advance || 0));
  }

  const cols  = ['rate','quantity','amount','advance','balance', ...fields.filter(f => !['rate','quantity','amount','advance','balance'].includes(f))];
  const uniq  = [...new Set(cols)];
  const setClause = uniq.map(f => `${f} = ?`).join(', ');
  const values    = uniq.map(f => merged[f] ?? null);

  await db().run(`UPDATE sales SET ${setClause} WHERE id = ?`, ...values, id);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db().run('DELETE FROM sales WHERE id = ?', id);
  return NextResponse.json({ success: true });
}
