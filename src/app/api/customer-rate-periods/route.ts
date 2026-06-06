import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/customer-rate-periods?customer=Name
export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('customer');
  if (!name) return NextResponse.json([]);
  const rows = await db().all(
    `SELECT id, size, rate, date_from, date_to FROM customer_rate_periods
     WHERE customer_name = ? ORDER BY size, date_from`,
    name
  );
  return NextResponse.json(rows);
}

// POST /api/customer-rate-periods
// Body: { customer_name, size, rate, date_from, date_to, apply_to_orders? }
export async function POST(req: NextRequest) {
  const { customer_name, size, rate, date_from, date_to, apply_to_orders } = await req.json();
  if (!customer_name || !size || !rate || !date_from || !date_to) {
    return NextResponse.json({ error: 'customer_name, size, rate, date_from, date_to required' }, { status: 400 });
  }

  const database = db();

  // Save the rate period
  await database.run(
    `INSERT INTO customer_rate_periods (customer_name, size, rate, date_from, date_to)
     VALUES (?, ?, ?, ?, ?)`,
    customer_name, size, rate, date_from, date_to
  );

  let orders_updated = 0;

  if (apply_to_orders) {
    // Update all orders for this customer+size within the date range
    const orders = await database.all(
      `SELECT id, quantity FROM sales
       WHERE customer_name = ? AND size = ? AND date >= ? AND date <= ?`,
      customer_name, size, date_from, date_to
    );

    for (const order of orders) {
      const qty = Number(order.quantity);
      const newAmount = Math.round(qty * rate * 100) / 100;
      const advanceRow = await database.get(
        `SELECT advance FROM sales WHERE id = ?`, order.id
      );
      const advance = Number(advanceRow?.advance || 0);
      const newBalance = Math.max(0, newAmount - advance);
      const newStatus = newBalance === 0 ? 'CLOSED' : 'OPEN';

      await database.run(
        `UPDATE sales SET rate = ?, amount = ?, balance = ?, status = ? WHERE id = ?`,
        rate, newAmount, newBalance, newStatus, order.id
      );
      orders_updated++;
    }
  }

  return NextResponse.json({ ok: true, orders_updated });
}

// DELETE /api/customer-rate-periods?id=123
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await db().run(`DELETE FROM customer_rate_periods WHERE id = ?`, id);
  return NextResponse.json({ ok: true });
}
