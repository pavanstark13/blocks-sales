import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customer = searchParams.get('customer');
  const month    = searchParams.get('month');
  const search   = searchParams.get('search');
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
       FROM payments ${wc} ORDER BY date DESC, id DESC`,
      ...apParams
    );
    return NextResponse.json({ payments: pays });
  }

  // Customer sidebar list — totals filtered by date range if given
  const listWhere = ['customer_name IS NOT NULL'];
  const listParams: unknown[] = [];
  if (dateFrom) { listWhere.push('date >= ?'); listParams.push(dateFrom); }
  if (dateTo)   { listWhere.push('date <= ?'); listParams.push(dateTo); }

  const customers = await database.all(`
    SELECT customer_name, MAX(address) as address, MAX(phone) as phone,
      COUNT(*) as orders,
      ROUND(SUM(COALESCE(amount,0)),2)  as total_debit,
      ROUND(SUM(COALESCE(advance,0)),2) as total_credit,
      ROUND(SUM(COALESCE(balance,0)),2) as closing_balance
    FROM sales WHERE ${listWhere.join(' AND ')}
    GROUP BY customer_name ORDER BY closing_balance DESC, customer_name
  `, ...listParams);

  if (!customer) {
    return NextResponse.json({ customers, entries: [], payments: [], summary: null });
  }

  // Sales entries for this customer
  let where = 'WHERE customer_name = ?';
  const params: unknown[] = [customer];
  if (month)    { where += ' AND month_label = ?'; params.push(month); }
  if (dateFrom) { where += ' AND date >= ?';       params.push(dateFrom); }
  if (dateTo)   { where += ' AND date <= ?';       params.push(dateTo); }
  if (search)   { where += ' AND (address LIKE ? OR notes LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const rows = await database.all(
    `SELECT id, date, address, site_name, size, quantity, qty_4inch, qty_6inch, qty_8inch,
            rate, amount, advance, balance, status, payment_mode, notes, month_label
     FROM sales ${where} ORDER BY date ASC, id ASC`,
    ...params
  );

  // Payment history from payments table
  let payWhere = 'WHERE customer_name = ?';
  const payParams: unknown[] = [customer];
  if (dateFrom) { payWhere += ' AND date >= ?'; payParams.push(dateFrom); }
  if (dateTo)   { payWhere += ' AND date <= ?'; payParams.push(dateTo); }

  const payments = await database.all(
    `SELECT id, date, amount, payment_mode, notes FROM payments
     ${payWhere} ORDER BY date ASC, id ASC`,
    ...payParams
  );

  // Build unified ledger: merge sales (debit) and payments (credit) sorted by date
  type LedgerRow = {
    row_type: 'sale' | 'payment' | 'advance_credit';
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
    debit: Number(row.amount) || 0,
    credit: 0,
    running_balance: 0,
  })) as LedgerRow[];

  // Separate visible rows for any advance paid at time of delivery
  const advanceCreditRows = (rows as Record<string,unknown>[])
    .filter(row => Number(row.advance) > 0)
    .map(row => ({
      row_type: 'advance_credit' as const,
      id: Number(row.id),
      date: String(row.date),
      debit: 0,
      credit: Number(row.advance) || 0,
      payment_mode: row.payment_mode,
      notes: row.site_name || row.address || '',
      running_balance: 0,
    })) as LedgerRow[];

  const paymentRows = (payments as Record<string,unknown>[]).map(p => ({
    ...p,
    row_type: 'payment' as const,
    id: Number(p.id),
    date: String(p.date),
    debit: 0,
    credit: Number(p.amount) || 0,
    running_balance: 0,
  })) as LedgerRow[];

  // Sort: sales → advance_credits → payments on same date; within type sort by id
  const typeOrder: Record<string, number> = { sale: 0, advance_credit: 1, payment: 2 };
  const merged = [...saleRows, ...advanceCreditRows, ...paymentRows].sort((a, b) => {
    if (a.date !== b.date) return (a.date as string).localeCompare(b.date as string);
    const ao = typeOrder[a.row_type] ?? 1;
    const bo = typeOrder[b.row_type] ?? 1;
    if (ao !== bo) return ao - bo;
    return Number(a.id) - Number(b.id);
  });

  let runningBalance = 0;
  const entries: LedgerRow[] = merged.map(row => {
    runningBalance = runningBalance + row.debit - row.credit;
    return { ...row, running_balance: Math.round(runningBalance * 100) / 100 };
  });

  const totalDebit  = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  const total4 = rows.reduce((s, r) => {
    const q4 = Number(r.qty_4inch) || 0;
    return s + (q4 > 0 ? q4 : (Number(r.size) === 4 ? Number(r.quantity) || 0 : 0));
  }, 0);
  const total6 = rows.reduce((s, r) => {
    const q6 = Number(r.qty_6inch) || 0;
    return s + (q6 > 0 ? q6 : (Number(r.size) === 6 ? Number(r.quantity) || 0 : 0));
  }, 0);
  const total8 = rows.reduce((s, r) => {
    const q8 = Number(r.qty_8inch) || 0;
    return s + (q8 > 0 ? q8 : (Number(r.size) === 8 ? Number(r.quantity) || 0 : 0));
  }, 0);

  const summary = {
    total_debit:     totalDebit,
    total_credit:    totalCredit,
    closing_balance: runningBalance,
    total_orders:    rows.length,
    open_orders:     rows.filter(r => r.status === 'OPEN' || r.status === 'PENDING').length,
    payment_count:   payments.length,
    total_payments:  payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    total_qty:       rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0),
    total_4inch:     total4,
    total_6inch:     total6,
    total_8inch:     total8,
  };

  return NextResponse.json({ customers, entries, payments, summary });
}
