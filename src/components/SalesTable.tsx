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
  vehicle_no: string;
}

const MONTHS = ['JULY-25','AUG-25','SEPT-25','OCTO-25','NOV-2025','DEC','JAN-2026','FEB-26','MAR-26','Apr-26','MAY-26'];
const STATUSES = ['CLOSED','OPEN','PENDING'];
const STATUS_NEXT: Record<string, string> = { CLOSED: 'OPEN', OPEN: 'PENDING', PENDING: 'CLOSED' };
const STATUS_COLOR: Record<string, string> = {
  CLOSED: 'bg-green-100 text-green-800',
  OPEN:   'bg-amber-100 text-amber-800',
  PENDING:'bg-blue-100 text-blue-800',
};

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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editing, setEditing] = useState<Partial<Sale> | null>(null);
  const [challan, setChallan] = useState<Sale | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (month)    params.set('month', month);
    if (status)   params.set('status', status);
    if (customer) params.set('search', customer);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const res = await fetch('/api/sales?' + params);
    const data = await res.json();
    setSales(data.data);
    setTotal(data.total);
    setLoading(false);
  }, [page, month, status, customer, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this sale?')) return;
    await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    load(); onRefresh();
  };

  const handleMarkClosed = async (sale: Sale) => {
    await fetch(`/api/sales/${sale.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', balance: 0, advance: sale.amount }),
    });
    load(); onRefresh();
  };

  // Quick status cycle: click badge to go CLOSED→OPEN→PENDING→CLOSED
  const handleStatusCycle = async (sale: Sale) => {
    const next = STATUS_NEXT[sale.status] || 'CLOSED';
    await fetch(`/api/sales/${sale.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    load(); onRefresh();
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    await fetch(`/api/sales/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    setEditing(null); load(); onRefresh();
  };

  const handleExport = async () => {
    setExporting(true);
    const params = new URLSearchParams({ type: 'sales' });
    if (month)    params.set('month', month);
    if (status)   params.set('status', status);
    if (customer) params.set('search', customer);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const res = await fetch('/api/export?' + params);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = month ? `sales-${month}.csv` : 'sales-all.csv';
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
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
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Search</label>
          <input placeholder="Name, address or phone..." value={customer}
            onChange={e => { setCustomer(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(dateFrom || dateTo) && (
          <div className="self-end">
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
              className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">
              Clear dates
            </button>
          </div>
        )}
        <span className="text-xs text-slate-400 self-end pb-2">{total} records</span>
        <div className="ml-auto self-end">
          <button onClick={handleExport} disabled={exporting}
            className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium">
            {exporting ? 'Exporting...' : '↓ Export CSV'}
          </button>
        </div>
      </div>

      {/* Tip about status */}
      <p className="text-xs text-slate-400 px-1">
        Tip: Click any status badge to toggle it instantly (CLOSED → OPEN → PENDING → CLOSED)
      </p>

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
                      {/* Clickable status badge */}
                      <button
                        onClick={() => handleStatusCycle(s)}
                        title="Click to change status"
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-75 transition-opacity ${STATUS_COLOR[s.status] || 'bg-slate-100 text-slate-600'}`}>
                        {s.status}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => setChallan(s)}
                          className="text-xs text-slate-600 hover:underline">Challan</button>
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

      {/* Delivery Challan Modal */}
      {challan && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            {/* Print area */}
            <div id="challan-print" className="p-8 font-sans text-sm">
              {/* Header */}
              <div className="text-center mb-6 border-b-2 border-slate-800 pb-4">
                <h1 className="text-xl font-bold text-slate-900 tracking-wide">BLOCKS SALES</h1>
                <p className="text-xs text-slate-500 mt-0.5">Delivery Challan</p>
              </div>

              {/* Challan meta */}
              <div className="flex justify-between mb-5 text-xs text-slate-600">
                <div>
                  <p><span className="font-semibold">Challan No:</span> {challan.id}</p>
                  <p className="mt-1"><span className="font-semibold">Date:</span> {challan.date}</p>
                  {challan.vehicle_no && (
                    <p className="mt-1"><span className="font-semibold">Vehicle No:</span> {challan.vehicle_no}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{challan.customer_name || '—'}</p>
                  {challan.address && <p className="text-slate-500">{challan.address}</p>}
                  {challan.phone   && <p className="text-slate-500">{challan.phone}</p>}
                </div>
              </div>

              {/* Items table */}
              <table className="w-full border border-slate-300 text-xs mb-6">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-3 py-2 text-left">Description</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Qty</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Rate (₹)</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 px-3 py-2">{challan.size}&quot; Solid Cement Block</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">{fmt(challan.quantity)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">{challan.rate ?? '—'}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-semibold">{fmtCur(challan.amount)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right">Total</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">{fmtCur(challan.amount)}</td>
                  </tr>
                  {(challan.advance ?? 0) > 0 && (
                    <tr>
                      <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right text-emerald-700">Advance Paid</td>
                      <td className="border border-slate-300 px-3 py-2 text-right text-emerald-700">{fmtCur(challan.advance)}</td>
                    </tr>
                  )}
                  {(challan.balance ?? 0) > 0 && (
                    <tr className="font-bold text-rose-700">
                      <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right">Balance Due</td>
                      <td className="border border-slate-300 px-3 py-2 text-right">{fmtCur(challan.balance)}</td>
                    </tr>
                  )}
                </tfoot>
              </table>

              {/* Signatures */}
              <div className="flex justify-between mt-8 pt-4 text-xs text-slate-500 border-t border-slate-200">
                <div className="text-center">
                  <div className="h-10 border-b border-slate-400 w-32 mb-1" />
                  <p>Receiver&apos;s Signature</p>
                </div>
                <div className="text-center">
                  <div className="h-10 border-b border-slate-400 w-32 mb-1" />
                  <p>Authorised Signatory</p>
                </div>
              </div>
            </div>

            {/* Action buttons — hidden when printing */}
            <div className="flex justify-end gap-2 px-6 pb-5 print:hidden">
              <button onClick={() => setChallan(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
              <button onClick={() => window.print()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">🖨 Print</button>
            </div>
          </div>
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
