'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface LedgerEntry {
  row_type: 'sale' | 'payment' | 'advance_credit';
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

  type EditTarget = { type: 'sale' | 'payment' | 'advance'; id: number; fields: Record<string, string> };
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const toggleGroup = (key: string) => setExpandedGroups(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  const handleEditSale = (e: LedgerEntry) => setEditTarget({
    type: 'sale', id: e.id, fields: {
      date: e.date, site_name: e.site_name || '',
      qty_4inch: String(e.qty_4inch || ''), qty_6inch: String(e.qty_6inch || ''), qty_8inch: String(e.qty_8inch || ''),
      rate: String(e.rate || ''), advance: String(e.advance || 0),
      payment_mode: e.payment_mode || '', status: e.status || 'OPEN', notes: e.notes || '',
    }
  });

  const handleEditPayment = (e: LedgerEntry) => setEditTarget({
    type: 'payment', id: e.id, fields: {
      date: e.date, amount: String(e.credit), payment_mode: e.payment_mode || '', notes: (e.notes as string) || '',
    }
  });

  const handleEditAdvance = (e: LedgerEntry) => setEditTarget({
    type: 'advance', id: e.id, fields: {
      advance: String(e.credit), payment_mode: e.payment_mode || '',
    }
  });

  const saveEdit = async () => {
    if (!editTarget || !selected) return;
    setEditBusy(true);
    const { type, id, fields } = editTarget;
    if (type === 'sale') {
      await fetch(`/api/sales/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: fields.date, site_name: fields.site_name || null,
          qty_4inch: parseInt(fields.qty_4inch) || 0, qty_6inch: parseInt(fields.qty_6inch) || 0, qty_8inch: parseInt(fields.qty_8inch) || 0,
          rate: parseFloat(fields.rate) || null, advance: parseFloat(fields.advance) || 0,
          payment_mode: fields.payment_mode || null, status: fields.status, notes: fields.notes || null,
        }),
      });
    } else if (type === 'payment') {
      await fetch(`/api/payments/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: fields.date, amount: parseFloat(fields.amount),
          payment_mode: fields.payment_mode || null, notes: fields.notes || null,
        }),
      });
    } else {
      await fetch(`/api/sales/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advance: parseFloat(fields.advance) || 0, payment_mode: fields.payment_mode || null }),
      });
    }
    setEditBusy(false); setEditTarget(null);
    await loadLedger(selected);
  };

  const handleDelete = async (type: 'sale' | 'payment' | 'advance', id: number) => {
    const msg = type === 'sale' ? 'Delete this load entry? This cannot be undone.'
      : type === 'payment' ? 'Delete this payment record?'
      : 'Remove advance from this load?';
    if (!confirm(msg)) return;
    if (type === 'sale') {
      await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    } else if (type === 'payment') {
      await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/sales/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advance: 0 }),
      });
    }
    if (selected) await loadLedger(selected);
  };

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
                <h1 className="text-3xl font-black tracking-wide" style={{fontFamily: 'serif'}}>BLOCKS SALES</h1>
                <div className="text-sm font-medium mt-0.5 tracking-widest uppercase">Customer Ledger Statement</div>
                <div className="mt-3 border-t-2 border-b border-black pt-2 pb-1">
                  <p className="text-xl font-bold">{selected}</p>
                  {selectedInfo?.address && <p className="text-sm font-medium">{selectedInfo.address}</p>}
                  {selectedInfo?.phone && <p className="text-sm">Ph: {selectedInfo.phone}</p>}
                </div>
                <p className="text-xs mt-1 text-gray-600">
                  {dateFrom || dateTo ? `Period: ${dateFrom || '—'} to ${dateTo || '—'}  ·  ` : ''}
                  Printed: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Summary cards */}
              {summary && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-red-50 rounded-lg p-3 print-summary-box">
                      <p className="text-xs text-red-500 font-medium print:text-black">Total Sales (Dr)</p>
                      <p className="text-lg font-bold text-red-700 print:text-black">{fmtCur(summary.total_debit)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 print-summary-box">
                      <p className="text-xs text-green-500 font-medium print:text-black">Total Received (Cr)</p>
                      <p className="text-lg font-bold text-green-700 print:text-black">{fmtCur(summary.total_credit)}</p>
                    </div>
                    <div className={`rounded-lg p-3 print-summary-box ${summary.closing_balance > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                      <p className={`text-xs font-medium print:text-black ${summary.closing_balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        Closing Balance
                      </p>
                      <p className={`text-lg font-bold print:text-black ${summary.closing_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {fmtCur(summary.closing_balance)}
                        <span className="text-xs ml-1">{summary.closing_balance > 0 ? 'Dr' : 'Cr'}</span>
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 print-summary-box">
                      <p className="text-xs text-slate-500 font-medium print:text-black">Orders / Payments</p>
                      <p className="text-lg font-bold text-slate-700 print:text-black">
                        {summary.total_orders}
                        {summary.open_orders > 0 && (
                          <span className="text-xs text-amber-600 ml-1 print:text-black">({summary.open_orders} open)</span>
                        )}
                      </p>
                      {summary.payment_count > 0 && (
                        <p className="text-xs text-emerald-600 print:text-black">{summary.payment_count} payment{summary.payment_count > 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </div>
                  {/* Block quantity totals */}
                  <div className="bg-blue-50 rounded-lg px-4 py-3 flex flex-wrap gap-4 items-center qty-summary-bar">
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
                        if (e.row_type === 'payment' || e.row_type === 'advance_credit') {
                          groups.push([e]);
                          continue;
                        }
                        const siteKey = (e.site_name || e.address || '').toLowerCase().trim();
                        const lastG = groups[groups.length - 1];
                        if (
                          lastG && lastG[0].row_type === 'sale' &&
                          lastG[0].date === e.date &&
                          (lastG[0].site_name || lastG[0].address || '').toLowerCase().trim() === siteKey
                        ) {
                          lastG.push(e);
                        } else {
                          groups.push([e]);
                        }
                      }

                      const btnCls = 'p-0.5 text-slate-300 hover:text-blue-600 rounded transition-colors text-sm leading-none';
                      const delCls = 'p-0.5 text-slate-300 hover:text-red-500 rounded transition-colors text-sm leading-none';

                      return groups.map((group, gi) => {
                        const first = group[0];
                        const last = group[group.length - 1];
                        const groupKey = `grp-${gi}`;
                        const isExpanded = expandedGroups.has(groupKey);

                        if (first.row_type === 'payment') {
                          return (
                            <tr key={`pay-${first.id}`} className="hover:bg-slate-50 bg-emerald-50/40 payment-row">
                              <td className="px-3 py-2 text-xs text-slate-400">{gi + 1}</td>
                              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{first.date}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-emerald-700">Payment received</div>
                                <div className="text-xs text-slate-400">
                                  {first.payment_mode && <span className="mr-2">{first.payment_mode}</span>}
                                  {first.notes && <span>{first.notes as string}</span>}
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
                              <td className="px-3 py-2 print:hidden">
                                <div className="flex items-center justify-center gap-0.5">
                                  <span className="inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">PAID</span>
                                  <button onClick={() => handleEditPayment(first)} className={btnCls} title="Edit">✏</button>
                                  <button onClick={() => handleDelete('payment', first.id)} className={delCls} title="Delete">🗑</button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        if (first.row_type === 'advance_credit') {
                          return (
                            <tr key={`adv-${first.id}`} className="hover:bg-slate-50 bg-teal-50/60 payment-row">
                              <td className="px-3 py-2 text-xs text-slate-400">{gi + 1}</td>
                              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{first.date}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-teal-700">Received at delivery</div>
                                <div className="text-xs text-slate-400">
                                  {first.payment_mode && <span className="mr-2">{first.payment_mode}</span>}
                                  {first.notes && <span>{first.notes as string}</span>}
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
                              <td className="px-3 py-2 print:hidden">
                                <div className="flex items-center justify-center gap-0.5">
                                  <span className="inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">RCVD</span>
                                  <button onClick={() => handleEditAdvance(first)} className={btnCls} title="Edit">✏</button>
                                  <button onClick={() => handleDelete('advance', first.id)} className={delCls} title="Remove">🗑</button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        // Compute merged totals for sale group
                        let g4 = 0, g6 = 0, g8 = 0, gTotal = 0, gDebit = 0;
                        const rates = new Set<number>();
                        const statuses = new Set<string>();
                        for (const e of group) {
                          const has = ((e.qty_4inch || 0) + (e.qty_6inch || 0) + (e.qty_8inch || 0)) > 0;
                          if (has) { g4 += e.qty_4inch || 0; g6 += e.qty_6inch || 0; g8 += e.qty_8inch || 0; }
                          else { if (e.size===4) g4+=e.quantity||0; else if (e.size===6) g6+=e.quantity||0; else if (e.size===8) g8+=e.quantity||0; }
                          gTotal += e.quantity || 0; gDebit += e.debit || 0;
                          if (e.rate) rates.add(Number(e.rate));
                          if (e.status) statuses.add(e.status);
                        }
                        const site = first.site_name || first.address || '';
                        const rateDisplay = rates.size === 1 ? `₹${[...rates][0]}` : rates.size > 1 ? 'mixed' : '—';
                        const isOpen = statuses.has('OPEN') || statuses.has('PENDING');

                        // Multi-entry group expanded: show each load as its own row
                        if (group.length > 1 && isExpanded) {
                          return (
                            <React.Fragment key={groupKey}>
                              {group.map((e, ei) => {
                                const eHas = ((e.qty_4inch||0)+(e.qty_6inch||0)+(e.qty_8inch||0)) > 0;
                                const e4 = eHas ? (e.qty_4inch||0) : (e.size===4?e.quantity||0:0);
                                const e6 = eHas ? (e.qty_6inch||0) : (e.size===6?e.quantity||0:0);
                                const e8 = eHas ? (e.qty_8inch||0) : (e.size===8?e.quantity||0:0);
                                const eOpen = e.status==='OPEN' || e.status==='PENDING';
                                return (
                                  <tr key={`${groupKey}-${ei}`} className={`hover:bg-slate-50 ${eOpen?'bg-amber-50/30':''} ${ei===0?'border-t-2 border-blue-100':''}`}>
                                    <td className="px-3 py-2 text-xs text-slate-400">{ei===0?gi+1:''}</td>
                                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{e.date}</td>
                                    <td className="px-3 py-2">
                                      <div className="font-medium text-slate-800">{(e.site_name||e.address)||'Blocks supplied'}</div>
                                      <div className="text-xs text-blue-500 merged-note">Load {ei+1}/{group.length}</div>
                                    </td>
                                    <td className="px-3 py-2 text-right text-indigo-700 font-medium">{e4>0?fmt(e4):'—'}</td>
                                    <td className="px-3 py-2 text-right text-blue-700 font-medium">{e6>0?fmt(e6):'—'}</td>
                                    <td className="px-3 py-2 text-right text-violet-700 font-medium">{e8>0?fmt(e8):'—'}</td>
                                    <td className="px-3 py-2 text-right font-bold text-slate-700">{fmt(e.quantity||0)}</td>
                                    <td className="px-3 py-2 text-right text-slate-500 text-xs">{e.rate?`₹${e.rate}`:'—'}</td>
                                    <td className="px-3 py-2 text-right font-medium text-red-600">{e.debit>0?fmtCur(e.debit):'—'}</td>
                                    <td className="px-3 py-2 text-right text-slate-300">—</td>
                                    <td className={`px-3 py-2 text-right font-bold ${e.running_balance>0?'text-rose-600':'text-emerald-600'}`}>
                                      {fmtCur(e.running_balance)}<span className="text-xs ml-0.5 font-normal">{e.running_balance>0?'Dr':'Cr'}</span>
                                    </td>
                                    <td className="px-3 py-2 print:hidden">
                                      <div className="flex items-center justify-center gap-0.5">
                                        {ei===group.length-1 && (
                                          <button onClick={() => toggleGroup(groupKey)} className="text-xs text-blue-500 hover:text-blue-700 mr-1" title="Collapse">⊖</button>
                                        )}
                                        <button onClick={() => handleEditSale(e)} className={btnCls} title="Edit">✏</button>
                                        <button onClick={() => handleDelete('sale', e.id)} className={delCls} title="Delete">🗑</button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        }

                        // Single entry or collapsed multi-entry
                        return (
                          <tr key={groupKey} className={`hover:bg-slate-50 ${isOpen ? 'bg-amber-50/30' : ''}`}>
                            <td className="px-3 py-2 text-xs text-slate-400">{gi + 1}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{first.date}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-800">{site || 'Blocks supplied'}</div>
                              {group.length > 1 && (
                                <div className="text-xs text-slate-400 merged-note">{group.length} loads merged</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-indigo-700 font-medium">{g4>0?fmt(g4):'—'}</td>
                            <td className="px-3 py-2 text-right text-blue-700 font-medium">{g6>0?fmt(g6):'—'}</td>
                            <td className="px-3 py-2 text-right text-violet-700 font-medium">{g8>0?fmt(g8):'—'}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-700">{fmt(gTotal)}</td>
                            <td className="px-3 py-2 text-right text-slate-500 text-xs">{rateDisplay}</td>
                            <td className="px-3 py-2 text-right font-medium text-red-600">{gDebit>0?fmtCur(gDebit):'—'}</td>
                            <td className="px-3 py-2 text-right text-slate-300">—</td>
                            <td className={`px-3 py-2 text-right font-bold ${last.running_balance>0?'text-rose-600':'text-emerald-600'}`}>
                              {fmtCur(last.running_balance)}<span className="text-xs ml-0.5 font-normal">{last.running_balance>0?'Dr':'Cr'}</span>
                            </td>
                            <td className="px-3 py-2 print:hidden">
                              <div className="flex items-center justify-center gap-0.5">
                                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${isOpen?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>
                                  {isOpen?'OPEN':'CLOSED'}
                                </span>
                                {group.length > 1 ? (
                                  <button onClick={() => toggleGroup(groupKey)} className="text-xs text-blue-500 hover:text-blue-700 ml-1" title="Expand loads">⊕{group.length}</button>
                                ) : (
                                  <>
                                    <button onClick={() => handleEditSale(first)} className={btnCls} title="Edit">✏</button>
                                    <button onClick={() => handleDelete('sale', first.id)} className={delCls} title="Delete">🗑</button>
                                  </>
                                )}
                              </div>
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

            {/* Payment Receipts section — includes advance-at-delivery + separate payments */}
            {(() => {
              const advEntries = entries.filter(e => e.row_type === 'advance_credit');
              const allReceipts: { key: string; date: string; mode: string; notes: string; amount: number; label: string }[] = [
                ...advEntries.map(e => ({
                  key: `adv-${e.id}`,
                  date: e.date,
                  mode: (e.payment_mode as string) || '',
                  notes: (e.notes as string) || '',
                  amount: e.credit,
                  label: 'At delivery',
                })),
                ...payments.map(p => ({
                  key: `pay-${p.id}`,
                  date: p.date,
                  mode: p.payment_mode || '',
                  notes: p.notes || '',
                  amount: p.amount,
                  label: 'Payment',
                })),
              ].sort((a, b) => a.date.localeCompare(b.date));

              if (allReceipts.length === 0) return null;
              return (
                <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden print:rounded-none print:border print:border-slate-300 print:mt-6">
                  <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 print:bg-slate-100 print:border-slate-200">
                    <h3 className="text-xs font-semibold text-emerald-700 print:text-slate-600 uppercase tracking-wide">
                      Payment Receipts ({allReceipts.length})
                    </h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100">
                      <tr className="text-xs text-slate-500 font-semibold text-left">
                        <th className="px-4 py-2">#</th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Mode</th>
                        <th className="px-4 py-2">Notes</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allReceipts.map((r, i) => (
                        <tr key={r.key} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-xs text-slate-400">{i + 1}</td>
                          <td className="px-4 py-2 text-slate-600">{r.date}</td>
                          <td className="px-4 py-2 text-xs">
                            <span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${r.label === 'At delivery' ? 'bg-teal-100 text-teal-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {r.label}
                            </span>
                          </td>
                          <td className="px-4 py-2">{r.mode || '—'}</td>
                          <td className="px-4 py-2 text-slate-500">{r.notes || '—'}</td>
                          <td className="px-4 py-2 text-right font-semibold text-emerald-700">{fmtCur(r.amount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-50 font-semibold border-t border-emerald-200">
                        <td colSpan={5} className="px-4 py-2 text-sm text-right text-slate-600">Total Received</td>
                        <td className="px-4 py-2 text-right text-emerald-800">
                          {fmtCur(allReceipts.reduce((s, r) => s + r.amount, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Print footer */}
            <div className="hidden print:block mt-8 pt-3 border-t-2 border-black text-xs text-center">
              <span className="font-semibold">BLOCKS SALES Manager</span> — Computer-generated ledger statement. Not valid without authorised signature.
            </div>
          </>
        )}
      </div>

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-800 mb-4">
              {editTarget.type === 'sale' ? 'Edit Load' : editTarget.type === 'payment' ? 'Edit Payment' : 'Edit Advance'}
            </h3>
            <div className="space-y-3">
              {(editTarget.type === 'sale' || editTarget.type === 'payment') && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Date</label>
                  <input type="date" value={editTarget.fields.date}
                    onChange={e => setEditTarget(t => t ? { ...t, fields: { ...t.fields, date: e.target.value } } : null)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              {editTarget.type === 'sale' && (
                <>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Site / Project Name</label>
                    <input type="text" value={editTarget.fields.site_name}
                      onChange={e => setEditTarget(t => t ? { ...t, fields: { ...t.fields, site_name: e.target.value } } : null)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['qty_4inch', 'qty_6inch', 'qty_8inch'] as const).map((k, i) => (
                      <div key={k}>
                        <label className="block text-xs text-slate-500 mb-1">{['4"','6"','8"'][i]} Qty</label>
                        <input type="number" min="0" value={editTarget.fields[k]}
                          onChange={e => setEditTarget(t => t ? { ...t, fields: { ...t.fields, [k]: e.target.value } } : null)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Rate (₹)</label>
                      <input type="number" value={editTarget.fields.rate}
                        onChange={e => setEditTarget(t => t ? { ...t, fields: { ...t.fields, rate: e.target.value } } : null)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Status</label>
                      <select value={editTarget.fields.status}
                        onChange={e => setEditTarget(t => t ? { ...t, fields: { ...t.fields, status: e.target.value } } : null)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>OPEN</option><option>CLOSED</option><option>PENDING</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              {(editTarget.type === 'sale' || editTarget.type === 'advance') && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Advance at delivery (₹)</label>
                  <input type="number" min="0" value={editTarget.fields.advance}
                    onChange={e => setEditTarget(t => t ? { ...t, fields: { ...t.fields, advance: e.target.value } } : null)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              {editTarget.type === 'payment' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
                  <input type="number" min="0" value={editTarget.fields.amount}
                    onChange={e => setEditTarget(t => t ? { ...t, fields: { ...t.fields, amount: e.target.value } } : null)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment Mode</label>
                <select value={editTarget.fields.payment_mode}
                  onChange={e => setEditTarget(t => t ? { ...t, fields: { ...t.fields, payment_mode: e.target.value } } : null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— None —</option>
                  <option>CASH</option><option>NY A/C</option><option>MKL A/C</option><option>KMK A/C</option>
                </select>
              </div>
              {editTarget.type !== 'advance' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Notes</label>
                  <input type="text" value={editTarget.fields.notes || ''}
                    onChange={e => setEditTarget(t => t ? { ...t, fields: { ...t.fields, notes: e.target.value } } : null)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveEdit} disabled={editBusy}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {editBusy ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditTarget(null)}
                className="px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }

          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }

          /* Summary boxes */
          .print-summary-box {
            border: 1.5px solid #000 !important;
            padding: 6px 10px !important;
            background: #fff !important;
          }

          /* Ledger table */
          table { border-collapse: collapse !important; width: 100% !important; }
          th, td {
            border: 1px solid #333 !important;
            padding: 4px 7px !important;
            font-size: 10px !important;
            color: #000 !important;
            font-weight: 500 !important;
          }
          thead tr {
            background-color: #1e293b !important;
          }
          thead th {
            background-color: #1e293b !important;
            color: #fff !important;
            font-weight: 800 !important;
            font-size: 9px !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          tbody td {
            color: #111 !important;
            font-weight: 500 !important;
          }
          /* Amount / balance columns — bold */
          tbody td:nth-child(n+9) {
            font-weight: 700 !important;
          }
          /* Totals row */
          tbody tr:last-child td {
            background-color: #cbd5e1 !important;
            font-weight: 800 !important;
            border-top: 2.5px solid #000 !important;
            font-size: 10.5px !important;
          }
          /* Payment rows */
          tr.payment-row td {
            background-color: #dcfce7 !important;
            font-style: italic;
          }
          /* Merged rows note */
          .merged-note {
            color: #333 !important;
            font-size: 9px !important;
            font-weight: 600 !important;
          }

          /* Quantity summary bar */
          .qty-summary-bar {
            border: 1.5px solid #000 !important;
            background: #f8fafc !important;
            padding: 5px 10px !important;
            margin-top: 8px !important;
            font-size: 10px !important;
          }
        }
      `}</style>
    </div>
  );
}
