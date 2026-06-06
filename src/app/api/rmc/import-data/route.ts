import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import importData from './data.json';

interface SaleRow {
  date: string;
  customer_name: string | null;
  site_address: string | null;
  grade: string;
  quantity: number;
  rate: number | null;
  amount: number | null;
  pump_charge: number;
  total_amount: number | null;
  advance: number;
  balance: number;
  status: string;
  payment_mode: string | null;
  notes: string | null;
  month_label: string | null;
}

const rows = importData as SaleRow[];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const run = searchParams.get('run');

  // Preview mode — show what will be imported
  if (!run) {
    const byMonth: Record<string, number> = {};
    for (const r of rows) {
      const key = r.month_label || 'unknown';
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
    return NextResponse.json({
      message: 'RMC Import Preview — add ?run=1 to execute',
      total_records: rows.length,
      by_month: byMonth,
      sample: rows.slice(0, 5),
    });
  }

  // Execute import
  const database = db();

  // Check if already imported (avoid duplicates)
  const existing = await database.get('SELECT COUNT(*) as cnt FROM rmc_sales');
  const existingCount = Number(existing?.cnt ?? 0);
  if (existingCount > 0) {
    return NextResponse.json({
      error: `Import blocked: rmc_sales already has ${existingCount} records. Clear the table first or remove this guard.`,
    }, { status: 409 });
  }

  let inserted = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await database.run(
        `INSERT INTO rmc_sales
          (date, customer_name, site_address, grade, quantity, rate, amount,
           pump_charge, total_amount, advance, balance, status, payment_mode, notes, month_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.date, row.customer_name, row.site_address, row.grade,
        row.quantity, row.rate, row.amount, row.pump_charge,
        row.total_amount, row.advance, row.balance,
        row.status, row.payment_mode, row.notes, row.month_label
      );
      inserted++;
    } catch (e) {
      errors.push(`Row ${inserted + 1}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    errors: errors.slice(0, 10),
    message: `Imported ${inserted} of ${rows.length} RMC sales records.`,
  });
}
