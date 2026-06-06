import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/customers/payment
// Body: { customer_name, amount, payment_mode?, notes? }
// Distributes payment across open/pending orders (oldest first)
export async function POST(req: NextRequest) {
  const { customer_name, amount, payment_mode, notes } = await req.json();
  if (!customer_name || !amount || amount <= 0) {
    return NextResponse.json({ error: 'customer_name and amount > 0 required' }, { status: 400 });
  }

  const database = db();

  // Fetch all open/pending orders for this customer, oldest first
  const orders = await database.all(
    `SELECT id, amount, advance, balance FROM sales
     WHERE customer_name = ? AND status IN ('OPEN', 'PENDING') AND balance > 0
     ORDER BY date ASC, id ASC`,
    customer_name
  );

  let remaining = Number(amount);
  let updated = 0;
  const notesText = notes || `Bulk payment ₹${amount}${payment_mode ? ' via ' + payment_mode : ''}`;

  for (const order of orders) {
    if (remaining <= 0) break;
    const bal = Number(order.balance);
    const pay = Math.min(bal, remaining);
    const newAdvance = Number(order.advance) + pay;
    const newBalance = Math.max(0, bal - pay);
    const newStatus = newBalance === 0 ? 'CLOSED' : 'OPEN';

    await database.run(
      `UPDATE sales SET advance = ?, balance = ?, status = ?,
        notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END
       WHERE id = ?`,
      newAdvance, newBalance, newStatus, notesText, notesText, order.id
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
