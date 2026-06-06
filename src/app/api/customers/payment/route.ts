import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/customers/payment
// Body: { customer_name, amount, date?, payment_mode?, notes? }
// 1. Saves a payment record in the payments table (for ledger credit history)
// 2. Distributes across open/pending orders (oldest first) updating advance/balance
export async function POST(req: NextRequest) {
  const { customer_name, amount, date, payment_mode, notes } = await req.json();
  if (!customer_name || !amount || amount <= 0) {
    return NextResponse.json({ error: 'customer_name and amount > 0 required' }, { status: 400 });
  }

  const database = db();
  const payDate = date || new Date().toISOString().split('T')[0];

  // 1. Record the payment
  await database.run(
    `INSERT INTO payments (customer_name, date, amount, payment_mode, notes)
     VALUES (?, ?, ?, ?, ?)`,
    customer_name, payDate, amount, payment_mode || null, notes || null
  );

  // 2. Distribute across oldest open/pending orders
  const orders = await database.all(
    `SELECT id, amount, advance, balance FROM sales
     WHERE customer_name = ? AND status IN ('OPEN','PENDING') AND balance > 0
     ORDER BY date ASC, id ASC`,
    customer_name
  );

  let remaining = Number(amount);
  let updated = 0;

  for (const order of orders) {
    if (remaining <= 0) break;
    const bal = Number(order.balance);
    const pay = Math.min(bal, remaining);
    const newAdvance = Number(order.advance) + pay;
    const newBalance = Math.max(0, bal - pay);
    const newStatus = newBalance === 0 ? 'CLOSED' : 'OPEN';

    await database.run(
      `UPDATE sales SET advance = ?, balance = ?, status = ? WHERE id = ?`,
      newAdvance, newBalance, newStatus, order.id
    );
    remaining -= pay;
    updated++;
  }

  return NextResponse.json({
    orders_updated: updated,
    amount_applied: Number(amount) - remaining,
    leftover: remaining,
  });
}

// GET /api/customers/payment?customer=Name — fetch payment history
export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('customer');
  if (!name) return NextResponse.json([]);
  const rows = await db().all(
    `SELECT id, date, amount, payment_mode, notes FROM payments
     WHERE customer_name = ? ORDER BY date DESC, id DESC`,
    name
  );
  return NextResponse.json(rows);
}
