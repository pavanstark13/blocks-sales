'use client';

import { useEffect, useState, useCallback } from 'react';

interface LedgerEntry {
  row_type: 'sale' | 'payment';
  id: number;
  date: string;
  // sale fields
  address?: string;
  site_name?: string;
  size?: number;
  quantity?: number;
  qty_4inch?: number;
  qty_6inch?: number;
  qty_8inch?: number;
  rate?: number;
  amount?: number;
  advance?: number;
  balance?: number;
  status?: string;
  payment_mode?: string;
  notes?: string;
  month_label?: string;
  // computed
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
  address: string;
  phone: string;
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
  total_qty: number;
  total_4inch: number;
  total_6inch: number;
  total_8inch: number;
}

function fmtCur(n: number) {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n));
}

function fmt(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}

export default function Ledger() {
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

  // Load customer list
  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    fetch('/api/ledger?' + params).then(r => r.json()).then(d => setCustomers(d.customers));
  }, [dateFrom, dateTo]);

  const loadLedger = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    const params = new URLSearchParams({ customer: name });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const res = await fetch('/api/ledger?' + params);
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
    const res = await fetch('/api/ledger?' + params);
    const data = await res.json();
    setAllPays(data.payments || []);
    setAllPaysLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (viewMode === 'payments') loadAllPayments(); }, [viewMode, loadAllPayments]);

  const filtered = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return !q || c.customer_name?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q) || c.phone?.includes(q);
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
            placeholder="Search name, address, phone..."
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                onClick={() => {
                setSelected(c.customer_name);
                if (viewMode === 'payments') setPaySearch(c.customer_name);
              }}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected === c.customer_name ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.customer_name}</p>
                    {c.address && <p className="text-xs text-slate-400 truncate">{c.address}</p>}
                    {c.phone && <p className="text-xs text-blue-500">{c.phone}</p>}
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
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'ledger' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Customer Ledger
          </button>
          <button
            onClick={() => { setViewMode('payments'); setPaySearch(selected || ''); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'payments' ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {selected ? `${selected} — Payments` : 'Payment Register'}
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
                    <span className="text-xs text-slate-500">{allPays.filter(p => !paySearch || p.customer_name?.toLowerCase().includes(paySearch.toLowerCase())).length} payment(s)</span>
                    <span className="text-sm font-bold text-emerald-800">
                      Total: {fmtCur(allPays.filter(p => !paySearch || p.customer_name?.toLowerCase().includes(paySearch.toLowerCase())).reduce((s, p) => s + p.amount, 0))}
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
                  {selectedInfo?.address && <p className="text-sm text-slate-500">{selectedInfo.address}</p>}
                  {selectedInfo?.phone && <p className="text-sm text-blue-600">{selectedInfo.phone}</p>}
                </div>
                <button onClick={handlePrint}
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                  Print Ledger
                </button>
              </div>

              {/* Print header */}
              <div className="hidden print:block text-center mb-4">
                <h1 className="text-2xl font-bold">BLOCKS SALES</h1>
                <h2 className="text-lg font-semibold mt-1">Customer Ledger</h2>
                <p className="text-base mt-1">{selected}</p>
                {selectedInfo?.address && <p className="text-sm text-slate-600">{selectedInfo.address}</p>}
                {selectedInfo?.phone && <p className="text-sm">Ph: {selectedInfo.phone}</p>}
                <p className="text-xs text-slate-500 mt-1">
                  {dateFrom || dateTo ? `Period: ${dateFrom || '—'} to ${dateTo || '—'} · ` : ''}
                  Printed: {new Date().toLocaleDateString('en-IN')}
                </p>
                <hr className="mt-3" />
              </div>

              {/* Summary cards */}
              {summary && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  {/* Block quantity totals */}
                  <div className="bg-blue-50 rounded-lg px-4 py-3 flex flex-wrap gap-4 items-center">
                    <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Total Blocks Supplied</span>
                    {summary.total_4inch > 0 && (
                      <div className="text-sm">
                        <span className="text-indigo-500 font-medium text-xs mr-1">4&quot;</span>
                        <span className="font-bold text-indigo-700">{summary.total_4inch.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {summary.total_6inch > 0 && (
                      <div className="text-sm">
                        <span className="text-blue-500 font-medium text-xs mr-1">6&quot;</span>
                        <span className="font-bold text-blue-700">{summary.total_6inch.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {summary.total_8inch > 0 && (
                      <div className="text-sm">
                        <span className="text-violet-500 font-medium text-xs mr-1">8&quot;</span>
                        <span className="font-bold text-violet-700">{summary.total_8inch.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="text-sm border-l border-blue-200 pl-4">
                      <span className="text-blue-500 font-medium text-xs mr-1">Total</span>
                      <span className="font-bold text-blue-800">{summary.total_qty.toLocaleString('en-IN')} blocks</span>
                    </div>
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
                      <th className="px-3 py-2 text-right text-indigo-500">4&quot;</th>
                      <th className="px-3 py-2 text-right text-blue-500">6&quot;</th>
                      <th className="px-3 py-2 text-right text-violet-500">8&quot;</th>
                      <th className="px-3 py-2 text-right font-bold">Total</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right text-red-600">Debit (₹)</th>
                      <th className="px-3 py-2 text-right text-green-600">Credit (₹)</th>
                      <th className="px-3 py-2 text-right">Balance (₹)</th>
                      <th className="px-3 py-2 text-center print:hidden">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(() => {
                      // Group same-date + same-site/address sale rows into one display row
                      const groups: LedgerEntry[][] = [];
                      for (const e of entries) {
                        if (e.row_type === 'payment') {
                          groups.push([e]);
                          continue;
                        }
                        const siteKey = (e.site_name || e.address || '').toLowerCase().trim();
                        const last = groups[groups.length - 1];
                        if (
                          last && last[0].row_type === 'sale' &&
                          last[0].date === e.date &&
                          (last[0].site_name || last[0].address || '').toLowerCase().trim() === siteKey
                        ) {
                          last.push(e);
                        } else {
                          groups.push([e]);
                        }
                      }

                      return groups.map((group, gi) => {
                        const first = group[0];
                        const last = group[group.length - 1];

                        if (first.row_type === 'payment') {
                          return (
                            <tr key={`pay-${first.id}`} className="hover:bg-slate-50 bg-emerald-50/40">
                              <td className="px-3 py-2 text-xs text-slate-400">{gi + 1}</td>
                              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{first.date}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-emerald-700">Payment received</div>
                                <div className="text-xs text-slate-400">
                                  {first.payment_mode && <span className="mr-2">{first.payment_mode}</span>}
                                  {first.notes && <span>{first.notes}</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-slate-300">—</td>
                              <td className="px-3 py-2 text-right text-slate-300">—</td>
                              <td className="px-3 py-2 text-right text-slate-300">—</td>
                              <td className="px-3 py-2 text-right text-slate-300">—</td>
                              <td className="px-3 py-2 text-right text-slate-300">—</td>
                              <td className="px-3 py-2 text-right font-medium text-red-600">—</td>
                              <td className="px-3 py-2 text-right font-medium text-green-600">{fmtCur(first.credit)}</td>
                              <td className={`px-3 py-2 text-right font-bold ${last.running_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {fmtCur(last.running_balance)}
                                <span className="text-xs ml-0.5 font-normal">{last.running_balance > 0 ? 'Dr' : 'Cr'}</span>
                              </td>
                              <td className="px-3 py-2 text-center print:hidden">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">PAID</span>
                              </td>
                            </tr>
                          );
                        }

                        // Merge quantities across grouped sale rows
                        let g4 = 0, g6 = 0, g8 = 0, gTotal = 0, gDebit = 0;
                        const rates = new Set<number>();
                        const statuses = new Set<string>();
                        for (const e of group) {
                          const has = ((e.qty_4inch || 0) + (e.qty_6inch || 0) + (e.qty_8inch || 0)) > 0;
                          if (has) {
                            g4 += e.qty_4inch || 0;
                            g6 += e.qty_6inch || 0;
                            g8 += e.qty_8inch || 0;
                          } else {
                            if (e.size === 4) g4 += e.quantity || 0;
                            else if (e.size === 6) g6 += e.quantity || 0;
                            else if (e.size === 8) g8 += e.quantity || 0;
                          }
                          gTotal += e.quantity || 0;
                          gDebit += e.debit || 0;
                          if (e.rate) rates.add(Number(e.rate));
                          if (e.status) statuses.add(e.status);
                        }
                        const site = first.site_name || first.address || '';
                        const rateDisplay = rates.size === 1 ? `₹${[...rates][0]}` : rates.size > 1 ? 'mixed' : '—';
                        const isOpen = statuses.has('OPEN') || statuses.has('PENDING');

                        return (
                          <tr key={`grp-${gi}`}
                            className={`hover:bg-slate-50 ${isOpen ? 'bg-amber-50/30' : ''}`}>
                            <td className="px-3 py-2 text-xs text-slate-400">{gi + 1}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{first.date}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-800">
                                {site || 'Blocks supplied'}
                              </div>
                              {group.length > 1 && (
                                <div className="text-xs text-slate-400">{group.length} loads merged</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-indigo-700 font-medium">
                              {g4 > 0 ? fmt(g4) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-blue-700 font-medium">
                              {g6 > 0 ? fmt(g6) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-violet-700 font-medium">
                              {g8 > 0 ? fmt(g8) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-700">
                              {fmt(gTotal)}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500 text-xs">{rateDisplay}</td>
                            <td className="px-3 py-2 text-right font-medium text-red-600">
                              {gDebit > 0 ? fmtCur(gDebit) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-green-600">—</td>
                            <td className={`px-3 py-2 text-right font-bold ${last.running_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {fmtCur(last.running_balance)}
                              <span className="text-xs ml-0.5 font-normal">{last.running_balance > 0 ? 'Dr' : 'Cr'}</span>
                            </td>
                            <td className="px-3 py-2 text-center print:hidden">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                isOpen ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                              }`}>{isOpen ? 'OPEN' : 'CLOSED'}</span>
                            </td>
                          </tr>
                        );
                      });
                    })()}

                    {/* Totals row */}
                    {summary && (
                      <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300 text-xs">
                        <td colSpan={3} className="px-3 py-3 text-right text-slate-600 text-sm">TOTAL</td>
                        <td className="px-3 py-3 text-right text-indigo-700">
                          {summary.total_4inch > 0 ? fmt(summary.total_4inch) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-blue-700">
                          {summary.total_6inch > 0 ? fmt(summary.total_6inch) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-violet-700">
                          {summary.total_8inch > 0 ? fmt(summary.total_8inch) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-800 font-bold">
                          {fmt(summary.total_qty)}
                        </td>
                        <td className="px-3 py-3" />
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
              This is a computer-generated ledger statement from BLOCKS SALES Manager.
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
