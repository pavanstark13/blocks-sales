import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customer = searchParams.get('customer_name') || searchParams.get('customer');
  const dateFrom = searchParams.get('date_from');
  const dateTo   = searchParams.get('date_to');

  const allPayments = searchParams.get('all_payments');

  const database = db();

  // All payments across all customers
  if (allPayments) {
    const apWhere: string[] = [];
    const apParams: unknown[] = [];
    if (dateFrom) { apWhere.push('date >= ?'); apParams.push(dateFrom); }
    if (dateTo)   { apWhere.push('date <= ?'); apParams.push(dateTo); }
    const wc = apWhere.length ? 'WHERE ' + apWhere.join(' AND ') : '';
    const pays = await database.all(
      `SELECT id, date, customer_name, amount, payment_mode, notes
       FROM rmc_payments ${wc} ORDER BY date DESC, id DESC`,
      ...apParams
    );
    return NextResponse.json({ payments: pays });
  }

  // Customer list (for sidebar)
  const sDW: string[] = ['customer_name IS NOT NULL'];
  const pDW: string[] = ['customer_name IS NOT NULL'];
  const sDParams: unknown[] = [];
  const pDParams: unknown[] = [];
  if (dateFrom) { sDW.push('date >= ?'); sDParams.push(dateFrom); pDW.push('date >= ?'); pDParams.push(dateFrom); }
  if (dateTo)   { sDW.push('date <= ?'); sDParams.push(dateTo);   pDW.push('date <= ?'); pDParams.push(dateTo); }

  const customers = await database.all(`
    SELECT customer_name, MAX(site_address) as site_address,
      SUM(orders) as orders,
      ROUND(SUM(total_debit), 2) as total_debit,
      ROUND(SUM(total_credit), 2) as total_credit,
      ROUND(SUM(total_debit) - SUM(total_credit), 2) as closing_balance
    FROM (
      SELECT customer_name, site_address, COUNT(*) as orders,
        SUM(COALESCE(total_amount, 0)) as total_debit, 0 as total_credit
      FROM rmc_sales WHERE ${sDW.join(' AND ')}
      GROUP BY customer_name
      UNION ALL
      SELECT customer_name, NULL as site_address, 0, 0, SUM(COALESCE(amount, 0))
      FROM rmc_payments WHERE ${pDW.join(' AND ')}
      GROUP BY customer_name
    ) GROUP BY customer_name ORDER BY closing_balance DESC, customer_name
  `, ...sDParams, ...pDParams);

  if (!customer) {
    return NextResponse.json({ customers, entries: [], payments: [], summary: null });
  }

  // Sales entries for this customer
  let where = 'WHERE customer_name = ?';
  const params: unknown[] = [customer];
  if (dateFrom) { where += ' AND date >= ?'; params.push(dateFrom); }
  if (dateTo)   { where += ' AND date <= ?'; params.push(dateTo); }

  const rows = await database.all(
    `SELECT id, date, site_address, grade, quantity, rate, amount, pump_charge, total_amount, advance, balance, status, payment_mode, notes, month_label
     FROM rmc_sales ${where} ORDER BY date ASC, id ASC`,
    ...params
  );

  // Payment history
  let payWhere = 'WHERE customer_name = ?';
  const payParams: unknown[] = [customer];
  if (dateFrom) { payWhere += ' AND date >= ?'; payParams.push(dateFrom); }
  if (dateTo)   { payWhere += ' AND date <= ?'; payParams.push(dateTo); }

  const payments = await database.all(
    `SELECT id, date, amount, payment_mode, notes FROM rmc_payments
     ${payWhere} ORDER BY date ASC, id ASC`,
    ...payParams
  );

  // Build unified ledger
  type LedgerRow = {
    row_type: 'sale' | 'payment';
    id: number;
    date: string;
    debit: number;
    credit: number;
    running_balance: number;
    [k: string]: unknown;
  };

  const saleRows = rows.map(row => ({
    ...row,
    row_type: 'sale' as const,
    id: Number(row.id),
    date: String(row.date),
    debit: Number(row.total_amount) || 0,
    credit: Number(row.advance) || 0,
    running_balance: 0,
  })) as LedgerRow[];

  const paymentRows = (payments as Record<string, unknown>[]).map(p => ({
    ...p,
    row_type: 'payment' as const,
    id: Number(p.id),
    date: String(p.date),
    debit: 0,
    credit: Number(p.amount) || 0,
    running_balance: 0,
  })) as LedgerRow[];

  const merged = [...saleRows, ...paymentRows].sort((a, b) => {
    if (a.date !== b.date) return (a.date as string).localeCompare(b.date as string);
    if (a.row_type === 'sale' && b.row_type === 'payment') return -1;
    if (a.row_type === 'payment' && b.row_type === 'sale') return 1;
    return Number(a.id) - Number(b.id);
  });

  let runningBalance = 0;
  const entries: LedgerRow[] = merged.map(row => {
    runningBalance = runningBalance + row.debit - row.credit;
    return { ...row, running_balance: Math.round(runningBalance * 100) / 100 };
  });

  const totalDebit  = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  const summary = {
    total_debit:     Math.round(totalDebit * 100) / 100,
    total_credit:    Math.round(totalCredit * 100) / 100,
    closing_balance: Math.round(runningBalance * 100) / 100,
    total_orders:    rows.length,
    open_orders:     rows.filter(r => r.status === 'OPEN' || r.status === 'PENDING').length,
    payment_count:   payments.length,
    total_payments:  payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
  };

  return NextResponse.json({ entries, payments, summary });
}
