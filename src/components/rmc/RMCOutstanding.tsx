'use client';

import { useState, useEffect, useCallback } from 'react';

interface Sale {
  id: number;
  date: string;
  customer_name: string | null;
  site_address: string | null;
  grade: string;
  quantity: number;
  total_amount: number | null;
  advance: number | null;
  balance: number | null;
  status: string;
  payment_mode: string | null;
}

function fmtCur(n: number | null | undefined) {
  if (n == null) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const GRADE_COLOR: Record<string, string> = {
  M10: 'bg-slate-100 text-slate-700',
  M15: 'bg-cyan-100 text-cyan-700',
  M20: 'bg-blue-100 text-blue-700',
  M25: 'bg-violet-100 text-violet-700',
  M30: 'bg-purple-100 text-purple-700',
  M35: 'bg-rose-100 text-rose-700',
  M40: 'bg-orange-100 text-orange-700',
};

const PAYMENT_MODES = ['CASH', 'NY A/C', 'MKL A/C', 'KMK A/C', 'KSC A/C', 'ONLINE'];

export default function RMCOutstanding({ onRefresh }: { onRefresh: () => void }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'PENDING'>('ALL');
  const [groupByCustomer, setGroupByCustomer] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });
  const [bulkPayCustomer, setBulkPayCustomer] = useState<string | null>(null);
  const [bulkPayForm, setBulkPayForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });

  const fetchOutstanding = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/rmc/sales?' + new URLSearchParams({ status: 'OPEN', limit: '500', ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) }).toString()),
        fetch('/api/rmc/sales?' + new URLSearchParams({ status: 'PENDING', limit: '500', ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) }).toString()),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setSales([...d1.data, ...d2.data].sort((a: Sale, b: Sale) => b.date.localeCompare(a.date)));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchOutstanding(); }, [fetchOutstanding]);

  const patchOrder = async (id: number, fields: Record<string, unknown>) => {
    await fetch(`/api/rmc/sales/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    fetchOutstanding();
    onRefresh();
  };

  const submitPayment = async (saleId: number, customerName: string) => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) return;
    const sale = sales.find(s => s.id === saleId);
    await patchOrder(saleId, { advance: (sale?.advance || 0) + amt });
    await fetch('/api/rmc/customers/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: customerName, amount: amt, date: payForm.date, payment_mode: payForm.mode, notes: payForm.notes }),
    });
    setPayingId(null);
    setPayForm({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });
  };

  const submitBulkPayment = async () => {
    if (!bulkPayCustomer) return;
    const amt = parseFloat(bulkPayForm.amount);
    if (!amt || amt <= 0) return;
    await fetch('/api/rmc/customers/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: bulkPayCustomer, amount: amt, date: bulkPayForm.date, payment_mode: bulkPayForm.mode, notes: bulkPayForm.notes }),
    });
    setBulkPayCustomer(null);
    setBulkPayForm({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });
    fetchOutstanding();
    onRefresh();
  };

  const visibleSales = statusFilter === 'ALL' ? sales : sales.filter(s => s.status === statusFilter);

  const openSales = sales.filter(s => s.status === 'OPEN');
  const pendingSales = sales.filter(s => s.status === 'PENDING');
  const openBalance = openSales.reduce((s, r) => s + (Number(r.balance) || 0), 0);
  const pendingBalance = pendingSales.reduce((s, r) => s + (Number(r.balance) || 0), 0);
  const totalBalance = openBalance + pendingBalance;
  const totalQty = visibleSales.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

  const grouped = groupByCustomer
    ? Object.entries(
        visibleSales.reduce<Record<string, Sale[]>>((acc, s) => {
          const k = s.customer_name || '(Unknown)';
          if (!acc[k]) acc[k] = [];
          acc[k].push(s);
          return acc;
        }, {})
      ).sort(([, a], [, b]) => {
        const ba = a.reduce((s, r) => s + (Number(r.balance) || 0), 0);
        const bb = b.reduce((s, r) => s + (Number(r.balance) || 0), 0);
        return bb - ba;
      })
    : null;

  const PayModal = ({ title, form, setForm, onSave, onClose }: {
    title: string;
    form: typeof payForm;
    setForm: (fn: (f: typeof payForm) => typeof payForm) => void;
    onSave: () => void;
    onClose: () => void;
  }) => (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">{title}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₹)</label>
            <input type="number" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
            <input type="date" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Payment Mode</label>
            <select value={form.mode} onChange={e => setForm(p => ({ ...p, mode: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input type="text" value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onSave}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 cursor-pointer">
            Save Payment
          </button>
          <button onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-l-4 border-slate-100 border-l-amber-500 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Open (Credit)</p>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{openSales.length} orders</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{fmtCur(openBalance)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Regular outstanding balance</p>
        </div>
        <div className="bg-white rounded-xl border border-l-4 border-slate-100 border-l-blue-500 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Pending (Short-term)</p>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{pendingSales.length} orders</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{fmtCur(pendingBalance)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Expected to settle shortly</p>
        </div>
        <div className="bg-white rounded-xl border border-l-4 border-slate-100 border-l-rose-500 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Total Outstanding</p>
            <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold">{sales.length} orders</span>
          </div>
          <p className="text-2xl font-bold text-rose-600">{fmtCur(totalBalance)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalQty.toFixed(1)} m³ across all</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
        </div>
        {/* Status filter */}
        <div className="flex gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 self-end">
          {(['ALL', 'OPEN', 'PENDING'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
                statusFilter === s
                  ? s === 'OPEN' ? 'bg-amber-500 text-white shadow-sm'
                  : s === 'PENDING' ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}>
              {s === 'ALL' ? 'All' : s === 'OPEN' ? 'Open' : 'Pending'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer self-end pb-1">
          <input type="checkbox" checked={groupByCustomer} onChange={e => setGroupByCustomer(e.target.checked)} className="rounded" />
          Group by Customer
        </label>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-48 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Grouped view */}
      {!loading && groupByCustomer && grouped && (
        <div className="space-y-3">
          {grouped.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
              <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-400 text-sm">No outstanding orders</p>
            </div>
          )}
          {grouped.map(([customer, orders]) => {
            const custBalance = orders.reduce((s, o) => s + (Number(o.balance) || 0), 0);
            const custQty = orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
            const custOpen = orders.filter(o => o.status === 'OPEN').length;
            const custPending = orders.filter(o => o.status === 'PENDING').length;
            return (
              <div key={customer} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800">{customer}</span>
                    <span className="text-xs text-slate-400 ml-2">{orders.length} orders · {custQty.toFixed(1)} m³</span>
                    <div className="flex gap-1.5 mt-0.5">
                      {custOpen > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                          {custOpen} Open
                        </span>
                      )}
                      {custPending > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          {custPending} Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-rose-600 text-lg">{fmtCur(custBalance)}</span>
                    <button
                      onClick={() => { setBulkPayCustomer(customer); setBulkPayForm(f => ({ ...f, amount: String(Math.round(custBalance)) })); }}
                      className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium cursor-pointer transition-colors duration-150"
                    >
                      Pay
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {orders.map(s => (
                    <div key={s.id} className={`px-4 py-2.5 flex items-center gap-3 text-sm border-l-2 ${s.status === 'OPEN' ? 'border-l-amber-400' : 'border-l-blue-400'}`}>
                      <span className="text-xs text-slate-400 w-20 flex-shrink-0">{s.date}</span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${GRADE_COLOR[s.grade] || 'bg-slate-100 text-slate-700'}`}>{s.grade}</span>
                      <span className="text-purple-600 font-medium w-14 flex-shrink-0">{Number(s.quantity).toFixed(1)} m³</span>
                      <span className="text-xs text-slate-400 flex-1 truncate">{s.site_address || ''}</span>
                      <span className="text-rose-600 font-semibold flex-shrink-0">{fmtCur(s.balance)}</span>
                      {/* Status toggle */}
                      <button
                        onClick={() => patchOrder(s.id, { status: s.status === 'OPEN' ? 'PENDING' : 'OPEN' })}
                        title={s.status === 'OPEN' ? 'Mark as Pending (short-term)' : 'Mark as Open (credit)'}
                        className={`text-xs px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors duration-150 flex-shrink-0 ${
                          s.status === 'OPEN'
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}>
                        {s.status}
                      </button>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { setPayingId(s.id); setPayForm(f => ({ ...f, amount: String(Math.round(Number(s.balance) || 0)) })); }}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium cursor-pointer">Pay</button>
                        <button onClick={() => patchOrder(s.id, { status: 'CLOSED' })}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium cursor-pointer">Close</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Flat table view */}
      {!loading && !groupByCustomer && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-500 font-semibold">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2 text-right">Qty m³</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibleSales.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-slate-400">No outstanding orders</td></tr>
                ) : visibleSales.map(s => (
                  <tr key={s.id} className={`hover:bg-slate-50 border-l-2 ${s.status === 'OPEN' ? 'border-l-amber-400' : 'border-l-blue-400'}`}>
                    <td className="px-3 py-2 text-xs text-slate-500">{s.date}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{s.customer_name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-24 truncate">{s.site_address || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${GRADE_COLOR[s.grade] || 'bg-slate-100 text-slate-700'}`}>
                        {s.grade}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-purple-600">{Number(s.quantity).toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmtCur(s.total_amount)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{fmtCur(s.advance)}</td>
                    <td className="px-3 py-2 text-right font-bold text-rose-600">{fmtCur(s.balance)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => patchOrder(s.id, { status: s.status === 'OPEN' ? 'PENDING' : 'OPEN' })}
                        title="Click to toggle status"
                        className={`text-xs px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors duration-150 ${
                          s.status === 'OPEN'
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}>
                        {s.status}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => patchOrder(s.id, { status: 'CLOSED' })}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium cursor-pointer">Close</button>
                        <button onClick={() => { setPayingId(s.id); setPayForm(f => ({ ...f, amount: String(Math.round(Number(s.balance) || 0)) })); }}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium cursor-pointer">Pay</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual Pay Modal */}
      {payingId !== null && (() => {
        const sale = sales.find(s => s.id === payingId);
        return (
          <PayModal
            title={`Pay — ${sale?.customer_name || ''}`}
            form={payForm}
            setForm={setPayForm}
            onSave={() => submitPayment(payingId, sale?.customer_name || '')}
            onClose={() => setPayingId(null)}
          />
        );
      })()}

      {/* Bulk Pay Modal */}
      {bulkPayCustomer && (
        <PayModal
          title={`Payment for ${bulkPayCustomer}`}
          form={bulkPayForm}
          setForm={setBulkPayForm}
          onSave={submitBulkPayment}
          onClose={() => setBulkPayCustomer(null)}
        />
      )}
    </div>
  );
}
