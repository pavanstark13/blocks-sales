import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import importData from './data.json';

interface PayRow {
  customer_name: string;
  date: string;
  amount: number;
  payment_mode: string | null;
  notes: string;
}

const rows = importData as PayRow[];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const run = searchParams.get('run');

  if (!run) {
    const byCustomer: Record<string, number> = {};
    for (const r of rows) {
      byCustomer[r.customer_name] = (byCustomer[r.customer_name] || 0) + r.amount;
    }
    return NextResponse.json({
      message: 'RMC Payments Import Preview — add ?run=1 to execute',
      total_records: rows.length,
      total_amount: rows.reduce((s, r) => s + r.amount, 0),
      by_customer: byCustomer,
    });
  }

  const database = db();

  const existing = await database.get('SELECT COUNT(*) as cnt FROM rmc_payments');
  const existingCount = Number(existing?.cnt ?? 0);
  if (existingCount > 0) {
    return NextResponse.json({
      error: `Import blocked: rmc_payments already has ${existingCount} records.`,
    }, { status: 409 });
  }

  let inserted = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await database.run(
        `INSERT INTO rmc_payments (customer_name, date, amount, payment_mode, notes)
         VALUES (?, ?, ?, ?, ?)`,
        row.customer_name, row.date, row.amount, row.payment_mode, row.notes
      );
      inserted++;
    } catch (e) {
      errors.push(`${row.customer_name}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    errors: errors.slice(0, 10),
    message: `Imported ${inserted} of ${rows.length} payment records.`,
  });
}
