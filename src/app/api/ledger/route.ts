import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customer = searchParams.get('customer');
  const month = searchParams.get('month');
  const search = searchParams.get('search');

  const database = db();

  // Customer list for the sidebar
  const customers = database.prepare(`
    SELECT
      customer_name,
      MAX(address) as address,
      MAX(phone) as phone,
      COUNT(*) as orders,
      ROUND(SUM(COALESCE(amount, 0)), 2) as total_debit,
      ROUND(SUM(COALESCE(advance, 0)), 2) as total_credit,
      ROUND(SUM(COALESCE(balance, 0)), 2) as closing_balance
    FROM sales
    WHERE customer_name IS NOT NULL
    GROUP BY customer_name
    ORDER BY closing_balance DESC, customer_name
  `).all();

  if (!customer) {
    return NextResponse.json({ customers, entries: [], summary: null });
  }

  // Ledger entries for a specific customer
  let where = 'WHERE customer_name = ?';
  const params: (string | number)[] = [customer];
  if (month) { where += ' AND month_label = ?'; params.push(month); }
  if (search) { where += ' AND (address LIKE ? OR notes LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const rows = database.prepare(`
    SELECT id, date, address, size, quantity, rate, amount, advance, balance, status, payment_mode, notes, month_label
    FROM sales ${where}
    ORDER BY date ASC, id ASC
  `).all(...params) as Record<string, unknown>[];

  // Build running-balance ledger
  let runningBalance = 0;
  const entries = rows.map(row => {
    const debit = Number(row.amount) || 0;
    const credit = Number(row.advance) || 0;
    runningBalance = runningBalance + debit - credit;
    return {
      ...row,
      debit,
      credit,
      running_balance: Math.round(runningBalance * 100) / 100,
    };
  });

  const summary = {
    total_debit: entries.reduce((s, e) => s + e.debit, 0),
    total_credit: entries.reduce((s, e) => s + e.credit, 0),
    closing_balance: runningBalance,
    total_orders: entries.length,
    open_orders: entries.filter(e => (e as Record<string, unknown>).status === 'OPEN' || (e as Record<string, unknown>).status === 'PENDING').length,
  };

  return NextResponse.json({ customers, entries, summary });
}
