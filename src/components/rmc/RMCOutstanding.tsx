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

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-blue-100 text-blue-700',
};

const GRADE_COLOR: Record<string, string> = {
  M10: 'bg-slate-100 text-slate-700',
  M15: 'bg-cyan-100 text-cyan-700',
  M20: 'bg-blue-100 text-blue-700',
  M25: 'bg-violet-100 text-violet-700',
  M30: 'bg-purple-100 text-purple-700',
};

export default function RMCOutstanding({ onRefresh }: { onRefresh: () => void }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });
  const [bulkPayCustomer, setBulkPayCustomer] = useState<string | null>(null);
  const [bulkPayForm, setBulkPayForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });

  const fetchOutstanding = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ status: 'OPEN' });
    // We'll fetch both OPEN and PENDING by fetching without status filter and filtering client-side
    const p2 = new URLSearchParams();
    if (dateFrom) p2.set('date_from', dateFrom);
    if (dateTo) p2.set('date_to', dateTo);
    p2.set('limit', '500');
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/rmc/sales?' + new URLSearchParams({ status: 'OPEN', limit: '500', ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) }).toString()),
        fetch('/api/rmc/sales?' + new URLSearchParams({ status: 'PENDING', limit: '500', ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) }).toString()),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setSales([...d1.data, ...d2.data].sort((a: Sale, b: Sale) => a.date.localeCompare(b.date)));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchOutstanding(); }, [fetchOutstanding]);

  const closeOrder = async (id: number) => {
    await fetch(`/api/rmc/sales/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    fetchOutstanding();
    onRefresh();
  };

  const submitPayment = async (saleId: number, customerName: string) => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) return;
    await fetch(`/api/rmc/sales/${saleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advance: (sales.find(s => s.id === saleId)?.advance || 0) + amt,
      }),
    });
    setPayingId(null);
    setPayForm({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });
    fetchOutstanding();
    onRefresh();
    // Also record in payments table via customer payment route
    await fetch('/api/rmc/customers/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: customerName, amount: amt, date: payForm.date, payment_mode: payForm.mode, notes: payForm.notes }),
    });
  };

  const submitBulkPayment = async () => {
    if (!bulkPayCustomer) return;
    const amt = parseFloat(bulkPayForm.amount);
    if (!amt || amt <= 0) return;
    await fetch('/api/rmc/customers/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: bulkPayCustomer,
        amount: amt,
        date: bulkPayForm.date,
        payment_mode: bulkPayForm.mode,
        notes: bulkPayForm.notes,
      }),
    });
    setBulkPayCustomer(null);
    setBulkPayForm({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });
    fetchOutstanding();
    onRefresh();
  };

  const totalBalance = sales.reduce((s, r) => s + (Number(r.balance) || 0), 0);
  const totalQty = sales.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

  // Group by customer if requested
  const grouped = groupByCustomer
    ? Object.entries(
        sales.reduce<Record<string, Sale[]>>((acc, s) => {
          const k = s.customer_name || '(Unknown)';
          if (!acc[k]) acc[k] = [];
          acc[k].push(s);
          return acc;
        }, {})
      )
    : null;

  return (
    <div className="space-y-4">
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
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer self-end pb-1">
          <input type="checkbox" checked={groupByCustomer} onChange={e => setGroupByCustomer(e.target.checked)}
            className="rounded" />
          Group by Customer
        </label>
        <div className="flex-1" />
        <div className="text-sm text-slate-600 self-end">
          <span className="font-semibold text-slate-800">{sales.length}</span> orders ·{' '}
          <span className="font-semibold text-purple-600">{totalQty.toFixed(1)} m³</span> ·{' '}
          Outstanding: <span className="font-bold text-rose-600">{fmtCur(totalBalance)}</span>
        </div>
      </div>

      {loading && <div className="text-center py-8 text-slate-400">Loading...</div>}

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
                  <th className="px-3 py-2 text-right">Advance</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sales.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-slate-400">No outstanding orders</td></tr>
                ) : sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-500">{s.date}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{s.customer_name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-28 truncate">{s.site_address || '—'}</td>
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[s.status] || ''}`}>{s.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => closeOrder(s.id)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Close</button>
                        <button onClick={() => { setPayingId(s.id); setPayForm(f => ({ ...f, amount: String(s.balance || '') })); }}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium">Pay</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grouped view */}
      {!loading && groupByCustomer && grouped && (
        <div className="space-y-3">
          {grouped.length === 0 && <p className="text-slate-400 text-center py-8">No outstanding orders</p>}
          {grouped.map(([customer, orders]) => {
            const custBalance = orders.reduce((s, o) => s + (Number(o.balance) || 0), 0);
            const custQty = orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
            return (
              <div key={customer} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">{customer}</span>
                    <span className="text-xs text-slate-500 ml-2">{orders.length} orders · {custQty.toFixed(1)} m³</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-rose-600">{fmtCur(custBalance)}</span>
                    <button
                      onClick={() => { setBulkPayCustomer(customer); setBulkPayForm(f => ({ ...f, amount: String(custBalance) })); }}
                      className="text-xs px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                    >
                      Pay
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {orders.map(s => (
                    <div key={s.id} className="px-4 py-2 flex items-center gap-4 text-sm">
                      <span className="text-xs text-slate-400 w-20">{s.date}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${GRADE_COLOR[s.grade] || ''}`}>{s.grade}</span>
                      <span className="text-purple-600 font-medium w-16">{Number(s.quantity).toFixed(1)} m³</span>
                      <span className="text-xs text-slate-500 flex-1">{s.site_address || ''}</span>
                      <span className="text-rose-600 font-semibold">{fmtCur(s.balance)}</span>
                      <button onClick={() => closeOrder(s.id)} className="text-xs text-emerald-600 hover:text-emerald-800">Close</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Individual Pay Modal */}
      {payingId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Record Payment</h3>
            <div className="space-y-3">
              {[
                { key: 'amount', label: 'Amount', type: 'number' },
                { key: 'date', label: 'Date', type: 'date' },
                { key: 'notes', label: 'Notes', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                  <input type={f.type} value={payForm[f.key as keyof typeof payForm]}
                    onChange={e => setPayForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Mode</label>
                <select value={payForm.mode} onChange={e => setPayForm(p => ({ ...p, mode: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>CASH</option><option>NY A/C</option><option>MKL A/C</option><option>KMK A/C</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => submitPayment(payingId, sales.find(s => s.id === payingId)?.customer_name || '')}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
              >Save Payment</button>
              <button onClick={() => setPayingId(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Pay Modal */}
      {bulkPayCustomer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-1">Payment for</h3>
            <p className="text-sm text-purple-600 font-semibold mb-4">{bulkPayCustomer}</p>
            <div className="space-y-3">
              {[
                { key: 'amount', label: 'Amount', type: 'number' },
                { key: 'date', label: 'Date', type: 'date' },
                { key: 'notes', label: 'Notes', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                  <input type={f.type} value={bulkPayForm[f.key as keyof typeof bulkPayForm]}
                    onChange={e => setBulkPayForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Mode</label>
                <select value={bulkPayForm.mode} onChange={e => setBulkPayForm(p => ({ ...p, mode: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>CASH</option><option>NY A/C</option><option>MKL A/C</option><option>KMK A/C</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={submitBulkPayment}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                Save Payment
              </button>
              <button onClick={() => setBulkPayCustomer(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
