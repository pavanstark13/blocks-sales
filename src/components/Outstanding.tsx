'use client';

import { useEffect, useState, useCallback } from 'react';

interface Sale {
  id: number;
  date: string;
  customer_name: string;
  address: string;
  phone: string;
  size: number;
  quantity: number;
  rate: number;
  amount: number;
  advance: number;
  balance: number;
  status: string;
  payment_mode: string;
  month_label: string;
  notes: string;
}

function fmtCur(n: number | null) {
  if (n == null) return '—';
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

export default function Outstanding({ onRefresh }: { onRefresh: () => void }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [updating, setUpdating] = useState<number | null>(null);
  const [payInput, setPayInput] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const dateParams = new URLSearchParams({ limit: '500' });
    if (dateFrom) dateParams.set('date_from', dateFrom);
    if (dateTo)   dateParams.set('date_to', dateTo);

    if (statusFilter) {
      dateParams.set('status', statusFilter);
      const res = await fetch('/api/sales?' + dateParams);
      const data = await res.json();
      setSales(data.data);
    } else {
      const openParams = new URLSearchParams(dateParams);
      openParams.set('status', 'OPEN');
      const pendingParams = new URLSearchParams(dateParams);
      pendingParams.set('status', 'PENDING');
      const [openData, pendingData] = await Promise.all([
        fetch('/api/sales?' + openParams).then(r => r.json()),
        fetch('/api/sales?' + pendingParams).then(r => r.json()),
      ]);
      setSales([...openData.data, ...pendingData.data].sort((a: Sale, b: Sale) => b.date.localeCompare(a.date)));
    }
    setLoading(false);
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handlePayment = async (sale: Sale) => {
    const paid = Number(payInput[sale.id] || 0);
    if (!paid) return;
    const newAdvance = (sale.advance || 0) + paid;
    const newBalance = Math.max(0, (sale.amount || 0) - newAdvance);
    const newStatus = newBalance === 0 ? 'CLOSED' : sale.status;
    setUpdating(sale.id);
    await fetch(`/api/sales/${sale.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advance: newAdvance, balance: newBalance, status: newStatus }),
    });
    setPayInput(p => ({ ...p, [sale.id]: '' }));
    setUpdating(null);
    load();
    onRefresh();
  };

  const totalOutstanding = sales.reduce((sum, s) => sum + (s.balance || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500">Total Outstanding</p>
          <p className="text-2xl font-bold text-rose-600">{fmtCur(totalOutstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500">Open Orders</p>
          <p className="text-2xl font-bold text-amber-600">{sales.filter(s => s.status === 'OPEN').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500">Pending Orders</p>
          <p className="text-2xl font-bold text-blue-600">{sales.filter(s => s.status === 'PENDING').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500">Total Records</p>
          <p className="text-2xl font-bold text-slate-700">{sales.length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Open + Pending</option>
            <option value="OPEN">Open Only</option>
            <option value="PENDING">Pending Only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 self-end">
            Clear dates
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Loading...</div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <p className="text-lg font-medium">No outstanding orders!</p>
            <p className="text-sm">All payments are cleared.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Address / Phone</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Record Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500">{s.date}</td>
                    <td className="px-4 py-2 font-medium">{s.customer_name || '—'}</td>
                    <td className="px-4 py-2 text-slate-500">
                      <div>{s.address || '—'}</div>
                      {s.phone && <div className="text-xs text-blue-600">{s.phone}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">{s.size}&quot;</td>
                    <td className="px-4 py-2 text-right">{s.quantity}</td>
                    <td className="px-4 py-2 text-right font-medium">{fmtCur(s.amount)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600">{fmtCur(s.advance)}</td>
                    <td className="px-4 py-2 text-right font-bold text-rose-600">{fmtCur(s.balance)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 items-center">
                        <input type="number" placeholder="Amount"
                          value={payInput[s.id] || ''}
                          onChange={e => setPayInput(p => ({ ...p, [s.id]: e.target.value }))}
                          className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={() => handlePayment(s)}
                          disabled={updating === s.id || !payInput[s.id]}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded-lg disabled:opacity-40 hover:bg-emerald-700">
                          {updating === s.id ? '...' : 'Pay'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
