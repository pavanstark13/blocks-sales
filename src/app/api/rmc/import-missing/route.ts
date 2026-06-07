import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import records from './data.json';

interface SaleRow {
  date: string;
  customer_name: string;
  site_address: string;
  grade: string;
  quantity: number;
  rate: number;
  total_amount: number;
  status: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const run = searchParams.get('run');

  const database = db();

  // Preview: show what will be imported
  const byCustomer: Record<string, number> = {};
  (records as SaleRow[]).forEach(r => {
    byCustomer[r.customer_name] = (byCustomer[r.customer_name] || 0) + 1;
  });
  const dateRange = [(records as SaleRow[])[0]?.date, (records as SaleRow[])[(records as SaleRow[]).length - 1]?.date];

  if (!run) {
    return NextResponse.json({
      message: '33 missing RMC records — add ?run=1 to import',
      total: (records as SaleRow[]).length,
      date_range: dateRange,
      by_customer: byCustomer,
      description: '29 pre-Aug-17 records (KGN Electricals + SRR Developers July deliveries) + 4 June 2026 records (Gurubalaji, TMR Construction, RK Corporation, Dayananda)',
    });
  }

  let inserted = 0;
  let skipped = 0;

  for (const r of records as SaleRow[]) {
    // Skip if already exists (same date + customer + grade + quantity)
    const exists = await database.get(
      `SELECT id FROM rmc_sales WHERE date = ? AND customer_name = ? AND grade = ? AND ABS(quantity - ?) < 0.01`,
      r.date, r.customer_name, r.grade, r.quantity
    );
    if (exists) { skipped++; continue; }

    await database.run(
      `INSERT INTO rmc_sales (date, customer_name, site_address, grade, quantity, rate, total_amount, advance, balance, pump_amount, status, payment_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, NULL)`,
      r.date, r.customer_name, r.site_address, r.grade,
      r.quantity, r.rate, r.total_amount,
      r.total_amount, r.status
    );
    inserted++;
  }

  return NextResponse.json({
    success: true,
    inserted,
    skipped,
    message: `Done. ${inserted} records inserted, ${skipped} already existed.`,
  });
}
