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
  notes: string;
  month_label: string;
}

const MONTHS = ['JULY-25','AUG-25','SEPT-25','OCTO-25','NOV-2025','DEC','JAN-2026','FEB-26','MAR-26','Apr-26','MAY-26'];

function fmt(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}

function fmtCur(n: number | null) {
  if (n == null) return '—';
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

export default function SalesTable({ onRefresh }: { onRefresh: () => void }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('');
  const [customer, setCustomer] = useState('');
  const [editing, setEditing] = useState<Partial<Sale> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (month) params.set('month', month);
    if (status) params.set('status', status);
    if (customer) params.set('customer', customer);
    const res = await fetch('/api/sales?' + params);
    const data = await res.json();
    setSales(data.data);
    setTotal(data.total);
    setLoading(false);
  }, [page, month, status, customer]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this sale?')) return;
    await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    load();
    onRefresh();
  };

  const handleMarkClosed = async (sale: Sale) => {
    await fetch(`/api/sales/${sale.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', balance: 0, advance: sale.amount }),
    });
    load();
    onRefresh();
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    await fetch(`/api/sales/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    load();
    onRefresh();
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Month</label>
          <select value={month} onChange={e => { setMonth(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Months</option>
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Status</label>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All</option>
            <option>CLOSED</option>
            <option>OPEN</option>
            <option>PENDING</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Customer Search</label>
          <input placeholder="Search customer..." value={customer}
            onChange={e => { setCustomer(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
        </div>
        <span className="text-xs text-slate-400 self-end pb-2">{total} records</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Advance</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500">{s.date}</td>
                    <td className="px-4 py-2 font-medium max-w-32 truncate" title={s.customer_name}>{s.customer_name || '—'}</td>
                    <td className="px-4 py-2 text-slate-500 max-w-28 truncate" title={s.address}>{s.address || '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{s.phone || '—'}</td>
                    <td className="px-4 py-2 text-right">{s.size}&quot;</td>
                    <td className="px-4 py-2 text-right">{fmt(s.quantity)}</td>
                    <td className="px-4 py-2 text-right">{s.rate ? `₹${s.rate}` : '—'}</td>
                    <td className="px-4 py-2 text-right font-medium">{fmtCur(s.amount)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600">{fmtCur(s.advance)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${s.balance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {fmtCur(s.balance)}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{s.payment_mode || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                        s.status === 'OPEN' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => setEditing(s)}
                          className="text-xs text-blue-600 hover:underline">Edit</button>
                        {s.status !== 'CLOSED' && (
                          <button onClick={() => handleMarkClosed(s)}
                            className="text-xs text-green-600 hover:underline">Close</button>
                        )}
                        <button onClick={() => handleDelete(s.id)}
                          className="text-xs text-red-500 hover:underline">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
            Previous
          </button>
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
            Next
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-semibold">Edit Sale #{editing.id}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'customer_name', label: 'Customer', type: 'text' },
                { key: 'date', label: 'Date', type: 'date' },
                { key: 'address', label: 'Address', type: 'text' },
                { key: 'phone', label: 'Phone', type: 'text' },
                { key: 'size', label: 'Size (inch)', type: 'number' },
                { key: 'quantity', label: 'Quantity', type: 'number' },
                { key: 'rate', label: 'Rate (₹)', type: 'number' },
                { key: 'advance', label: 'Advance (₹)', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                  <input type={f.type} value={(editing as Record<string, unknown>)[f.key] as string ?? ''}
                    onChange={e => setEditing(prev => ({ ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status</label>
                <select value={editing.status ?? 'CLOSED'}
                  onChange={e => setEditing(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>CLOSED</option>
                  <option>OPEN</option>
                  <option>PENDING</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment Mode</label>
                <select value={editing.payment_mode ?? ''}
                  onChange={e => setEditing(prev => ({ ...prev, payment_mode: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  <option>CASH</option>
                  <option>NY A/C</option>
                  <option>MKL A/C</option>
                  <option>KMK A/C</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Notes</label>
              <input value={editing.notes ?? ''}
                onChange={e => setEditing(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={saveEdit}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
