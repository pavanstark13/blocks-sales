'use client';

import { useEffect, useState, useCallback } from 'react';

interface LedgerEntry {
  row_type: 'sale' | 'payment';
  id: number;
  date: string;
  site_address?: string;
  grade?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  pump_charge?: number;
  total_amount?: number;
  advance?: number;
  balance?: number;
  status?: string;
  payment_mode?: string;
  notes?: string;
  debit: number;
  credit: number;
  running_balance: number;
}

interface PaymentRecord {
  id: number;
  date: string;
  amount: number;
  payment_mode: string;
  notes: string;
}

interface AllPaymentRecord {
  id: number;
  date: string;
  customer_name: string;
  amount: number;
  payment_mode: string;
  notes: string;
}

interface CustomerRow {
  customer_name: string;
  site_address: string;
  orders: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
}

interface Summary {
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  total_orders: number;
  open_orders: number;
  payment_count: number;
  total_payments: number;
}

function fmtCur(n: number) {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n));
}

export default function RMCLedger() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [printing, setPrinting] = useState(false);
  const [viewMode, setViewMode] = useState<'ledger' | 'payments'>('ledger');
  const [allPays, setAllPays] = useState<AllPaymentRecord[]>([]);
  const [allPaysLoading, setAllPaysLoading] = useState(false);
  const [paySearch, setPaySearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    fetch('/api/rmc/ledger?' + params).then(r => r.json()).then(d => setCustomers(d.customers || []));
  }, [dateFrom, dateTo]);

  const loadLedger = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    const params = new URLSearchParams({ customer: name });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const res = await fetch('/api/rmc/ledger?' + params);
    const data = await res.json();
    setEntries(data.entries);
    setPayments(data.payments || []);
    setSummary(data.summary);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (selected) loadLedger(selected); }, [selected, loadLedger]);

  const loadAllPayments = useCallback(async () => {
    setAllPaysLoading(true);
    const params = new URLSearchParams({ all_payments: '1' });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const res = await fetch('/api/rmc/ledger?' + params);
    const data = await res.json();
    setAllPays(data.payments || []);
    setAllPaysLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (viewMode === 'payments') loadAllPayments(); }, [viewMode, loadAllPayments]);

  const filtered = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return !q || c.customer_name?.toLowerCase().includes(q) || c.site_address?.toLowerCase().includes(q);
  });

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 100);
  };

  const selectedInfo = customers.find(c => c.customer_name === selected);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
      {/* Customer sidebar */}
      <div className="lg:col-span-1 print:hidden space-y-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 space-y-2">
          <input
            placeholder="Search customer or site..."
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="w-full text-xs text-slate-500 border border-slate-200 rounded-lg py-1 hover:bg-slate-50">
              Clear date filter
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex justify-between text-xs text-slate-500">
            <span>Customer</span>
            <span>Balance</span>
          </div>
          <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.customer_name}
                onClick={() => { setSelected(c.customer_name); setViewMode('ledger'); }}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected === c.customer_name && viewMode === 'ledger' ? 'bg-purple-50 border-l-2 border-purple-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.customer_name}</p>
                    {c.site_address && <p className="text-xs text-slate-400 truncate">{c.site_address}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${c.closing_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {c.closing_balance > 0 ? fmtCur(c.closing_balance) : '✓'}
                    </p>
                    <p className="text-xs text-slate-400">{c.orders} orders</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ledger detail */}
      <div className="lg:col-span-3 space-y-4">
        {/* View mode toggle */}
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => setViewMode('ledger')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'ledger' ? 'bg-purple-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Customer Ledger
          </button>
          <button
            onClick={() => setViewMode('payments')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'payments' ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Payment Register
          </button>
        </div>

        {viewMode === 'payments' ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">All Payments Register</h3>
              <input
                placeholder="Filter by customer..."
                value={paySearch}
                onChange={e => setPaySearch(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-56"
              />
            </div>
            {allPaysLoading ? (
              <div className="text-center py-12 text-slate-400">Loading payments...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr className="text-xs text-slate-600 font-semibold text-left">
                        <th className="px-4 py-2">#</th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Customer</th>
                        <th className="px-4 py-2">Mode</th>
                        <th className="px-4 py-2">Notes</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allPays
                        .filter(p => !paySearch || p.customer_name?.toLowerCase().includes(paySearch.toLowerCase()))
                        .map((p, i) => (
                          <tr key={p.id} className="hover:bg-emerald-50/40">
                            <td className="px-4 py-2 text-xs text-slate-400">{i + 1}</td>
                            <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{p.date}</td>
                            <td className="px-4 py-2 font-medium text-slate-800">{p.customer_name || '—'}</td>
                            <td className="px-4 py-2 text-slate-500">{p.payment_mode || '—'}</td>
                            <td className="px-4 py-2 text-slate-400 text-xs">{p.notes || '—'}</td>
                            <td className="px-4 py-2 text-right font-semibold text-emerald-700">{fmtCur(p.amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {allPays.length > 0 && (
                  <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                      {allPays.filter(p => !paySearch || p.customer_name?.toLowerCase().includes(paySearch.toLowerCase())).length} payment(s)
                    </span>
                    <span className="text-sm font-bold text-emerald-800">
                      Total: {fmtCur(
                        allPays
                          .filter(p => !paySearch || p.customer_name?.toLowerCase().includes(paySearch.toLowerCase()))
                          .reduce((s, p) => s + p.amount, 0)
                      )}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : !selected ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center h-64 text-slate-400">
            Select a customer from the left to view their ledger
          </div>
        ) : loading ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center h-64 text-slate-400">
            Loading ledger...
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 print:rounded-none print:border print:border-slate-300">
              <div className="flex items-start justify-between print:hidden">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selected}</h2>
                  {selectedInfo?.site_address && <p className="text-sm text-slate-500">{selectedInfo.site_address}</p>}
                </div>
                <button onClick={handlePrint}
                  className="px-4 py-2 text-sm bg-purple-700 text-white rounded-lg hover:bg-purple-800">
                  Print Ledger
                </button>
              </div>

              {/* Print header */}
              <div className="hidden print:block text-center mb-4">
                <h1 className="text-2xl font-bold">ASTRA CONMIX</h1>
                <h2 className="text-lg font-semibold mt-1">RMC Customer Ledger</h2>
                <p className="text-base mt-1">{selected}</p>
                {selectedInfo?.site_address && <p className="text-sm text-slate-600">{selectedInfo.site_address}</p>}
                <p className="text-xs text-slate-500 mt-1">
                  {dateFrom || dateTo ? `Period: ${dateFrom || '—'} to ${dateTo || '—'} · ` : ''}
                  Printed: {new Date().toLocaleDateString('en-IN')}
                </p>
                <hr className="mt-3" />
              </div>

              {/* Summary cards */}
              {summary && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-red-500 font-medium">Total Sales (Dr)</p>
                    <p className="text-lg font-bold text-red-700">{fmtCur(summary.total_debit)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-500 font-medium">Total Received (Cr)</p>
                    <p className="text-lg font-bold text-green-700">{fmtCur(summary.total_credit)}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${summary.closing_balance > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <p className={`text-xs font-medium ${summary.closing_balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      Closing Balance
                    </p>
                    <p className={`text-lg font-bold ${summary.closing_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {fmtCur(summary.closing_balance)}
                      <span className="text-xs ml-1">{summary.closing_balance > 0 ? 'Dr' : 'Cr'}</span>
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 font-medium">Orders / Payments</p>
                    <p className="text-lg font-bold text-slate-700">
                      {summary.total_orders}
                      {summary.open_orders > 0 && (
                        <span className="text-xs text-amber-600 ml-1">({summary.open_orders} open)</span>
                      )}
                    </p>
                    {summary.payment_count > 0 && (
                      <p className="text-xs text-emerald-600">{summary.payment_count} payment{summary.payment_count > 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Unified ledger table */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden print:rounded-none print:border print:border-slate-300">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 print:bg-slate-100">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Ledger Statement</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200">
                    <tr className="text-xs text-slate-600 font-semibold">
                      <th className="px-3 py-2 text-left w-6">#</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Particulars</th>
                      <th className="px-3 py-2 text-right">Grade</th>
                      <th className="px-3 py-2 text-right">m³</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right text-red-600">Debit (₹)</th>
                      <th className="px-3 py-2 text-right text-green-600">Credit (₹)</th>
                      <th className="px-3 py-2 text-right">Balance (₹)</th>
                      <th className="px-3 py-2 text-center print:hidden">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {entries.map((e, i) => (
                      <tr key={`${e.row_type}-${e.id}`}
                        className={`hover:bg-slate-50 ${
                          e.row_type === 'payment' ? 'bg-emerald-50/40' :
                          (e.status === 'OPEN' || e.status === 'PENDING') ? 'bg-amber-50/30' : ''
                        }`}>
                        <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{e.date}</td>
                        <td className="px-3 py-2">
                          {e.row_type === 'payment' ? (
                            <div>
                              <div className="font-medium text-emerald-700">Payment received</div>
                              <div className="text-xs text-slate-400">
                                {e.payment_mode && <span className="mr-2">{e.payment_mode}</span>}
                                {e.notes && <span>{e.notes}</span>}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium text-slate-800">RMC Delivered</div>
                              <div className="text-xs text-slate-400">
                                {e.payment_mode && <span className="mr-2">{e.payment_mode}</span>}
                                {e.notes && <span>{e.notes}</span>}
                                {e.site_address && !e.notes && <span>{e.site_address}</span>}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-purple-600">
                          {e.row_type === 'sale' ? e.grade : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {e.row_type === 'sale' ? Number(e.quantity ?? 0).toFixed(1) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-xs">
                          {e.row_type === 'sale' && e.rate ? `₹${e.rate}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-red-600">
                          {e.debit > 0 ? fmtCur(e.debit) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-600">
                          {e.credit > 0 ? fmtCur(e.credit) : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${e.running_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {fmtCur(e.running_balance)}
                          <span className="text-xs ml-0.5 font-normal">{e.running_balance > 0 ? 'Dr' : 'Cr'}</span>
                        </td>
                        <td className="px-3 py-2 text-center print:hidden">
                          {e.row_type === 'sale' ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              e.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                              e.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>{e.status}</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              PAID
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Totals row */}
                    {summary && (
                      <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                        <td colSpan={6} className="px-3 py-3 text-sm text-right text-slate-600">TOTAL</td>
                        <td className="px-3 py-3 text-right text-red-700">{fmtCur(summary.total_debit)}</td>
                        <td className="px-3 py-3 text-right text-green-700">{fmtCur(summary.total_credit)}</td>
                        <td className={`px-3 py-3 text-right ${summary.closing_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {fmtCur(summary.closing_balance)}
                          <span className="text-xs ml-0.5 font-normal">{summary.closing_balance > 0 ? 'Dr' : 'Cr'}</span>
                        </td>
                        <td className="print:hidden" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Receipts section */}
            {payments.length > 0 && (
              <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden print:rounded-none print:border print:border-slate-300 print:mt-6">
                <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 print:bg-slate-100 print:border-slate-200">
                  <h3 className="text-xs font-semibold text-emerald-700 print:text-slate-600 uppercase tracking-wide">
                    Payment Receipts ({payments.length})
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100">
                    <tr className="text-xs text-slate-500 font-semibold text-left">
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Mode</th>
                      <th className="px-4 py-2">Notes</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payments.map((p, i) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-4 py-2 text-slate-600">{p.date}</td>
                        <td className="px-4 py-2">{p.payment_mode || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{p.notes || '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold text-emerald-700">{fmtCur(p.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50 font-semibold border-t border-emerald-200">
                      <td colSpan={4} className="px-4 py-2 text-sm text-right text-slate-600">Total Received</td>
                      <td className="px-4 py-2 text-right text-emerald-800">
                        {fmtCur(payments.reduce((s, p) => s + p.amount, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Print footer */}
            <div className="hidden print:block mt-8 pt-4 border-t border-slate-300 text-xs text-slate-500 text-center">
              This is a computer-generated ledger statement from ASTRA CONMIX RMC Sales Manager.
            </div>
          </>
        )}
      </div>

      {printing && (
        <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
      )}
    </div>
  );
}
