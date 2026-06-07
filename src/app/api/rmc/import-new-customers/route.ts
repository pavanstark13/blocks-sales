import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import salesData from './data-sales.json';
import paymentsData from './data-payments.json';

interface SaleRecord {
  date: string;
  customer_name: string;
  site_address: string;
  grade: string;
  quantity: number;
  rate: number;
  total_amount: number;
  pump_amount: number;
  status: string;
}

interface PaymentRecord {
  date: string;
  customer_name: string;
  amount: number;
  payment_mode: string;
  notes: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const run = searchParams.get('run');

  const database = db();

  const salesByCustomer: Record<string, number> = {};
  (salesData as SaleRecord[]).forEach(s => {
    salesByCustomer[s.customer_name] = (salesByCustomer[s.customer_name] || 0) + 1;
  });

  const paysByCustomer: Record<string, number> = {};
  (paymentsData as PaymentRecord[]).forEach(p => {
    paysByCustomer[p.customer_name] = (paysByCustomer[p.customer_name] || 0) + 1;
  });

  if (!run) {
    return NextResponse.json({
      message: 'Import new RMC customer data — add ?run=1 to apply',
      sales_to_import: (salesData as SaleRecord[]).length,
      payments_to_import: (paymentsData as PaymentRecord[]).length,
      sales_by_customer: salesByCustomer,
      payments_by_customer: paysByCustomer,
    });
  }

  // Check for existing records to avoid double-import
  const existingCheck = await database.get(
    `SELECT COUNT(*) as cnt FROM rmc_sales WHERE customer_name IN ('Anaghaa Constructions','Karnataka Infratech','KEB Madhu','KGK','Pravriddhi Infratech','Secretary BGS','SGR Ground Engineering','Yankee Constructions LLP')`
  );
  const existingCount = Number((existingCheck as { cnt: number })?.cnt ?? 0);
  if (existingCount > 0) {
    return NextResponse.json({ error: `Already imported: ${existingCount} records found for new customers. Use ?run=1&force=1 to re-run`, existing: existingCount }, { status: 409 });
  }

  let salesInserted = 0;
  let paymentsInserted = 0;
  const paymentsSeen = new Set<string>();

  for (const s of salesData as SaleRecord[]) {
    const balance = s.total_amount > 0 ? s.total_amount - 0 : 0;
    await database.run(
      `INSERT INTO rmc_sales (date, customer_name, site_address, grade, quantity, rate, total_amount, advance, balance, pump_amount, status, payment_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL)`,
      s.date, s.customer_name, s.site_address, s.grade,
      s.quantity, s.rate, s.total_amount,
      balance, s.pump_amount, s.status
    );
    salesInserted++;
  }

  for (const p of paymentsData as PaymentRecord[]) {
    // Deduplicate by date+customer+amount
    const key = `${p.date}|${p.customer_name}|${p.amount}`;
    if (paymentsSeen.has(key)) continue;
    paymentsSeen.add(key);

    // Check if already in DB
    const exists = await database.get(
      `SELECT id FROM rmc_payments WHERE date = ? AND customer_name = ? AND amount = ?`,
      p.date, p.customer_name, p.amount
    );
    if (exists) continue;

    await database.run(
      `INSERT INTO rmc_payments (date, customer_name, amount, payment_mode, notes) VALUES (?, ?, ?, ?, ?)`,
      p.date, p.customer_name, p.amount, p.payment_mode, p.notes
    );
    paymentsInserted++;
  }

  return NextResponse.json({
    success: true,
    sales_inserted: salesInserted,
    payments_inserted: paymentsInserted,
    message: `Done. ${salesInserted} sales and ${paymentsInserted} payments imported.`,
  });
}
