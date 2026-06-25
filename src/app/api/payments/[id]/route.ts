import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ['date', 'amount', 'payment_mode', 'notes'];
  const fields = Object.keys(body).filter(k => allowed.includes(k));
  if (!fields.length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  const existing = await db().get('SELECT id FROM payments WHERE id = ?', id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => body[f]);
  await db().run(`UPDATE payments SET ${setClause} WHERE id = ?`, ...values, id);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db().run('DELETE FROM payments WHERE id = ?', id);
  return NextResponse.json({ success: true });
}
