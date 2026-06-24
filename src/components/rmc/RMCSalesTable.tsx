'use client';

import { useState, useEffect, useCallback } from 'react';
import PrintChallan from '../PrintChallan';

interface Sale {
  id: number;
  date: string;
  customer_name: string | null;
  site_address: string | null;
  grade: string;
  quantity: number;
  rate: number | null;
  amount: number | null;
  pump_charge: number | null;
  total_amount: number | null;
  advance: number | null;
  balance: number | null;
  payment_mode: string | null;
  status: string;
  notes: string | null;
  month_label: string | null;
}

interface SalesResponse {
  data: Sale[];
  total: number;
  page: number;
  limit: number;
}

function fmtCur(n: number | null | undefined) {
  if (n == null) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const STATUS_CYCLE: Record<string, string> = { OPEN: 'PENDING', PENDING: 'CLOSED', CLOSED: 'OPEN' };
const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-emerald-100 text-emerald-700',
};

const GRADE_COLOR: Record<string, string> = {
  M10: 'bg-slate-100 text-slate-700',
  M15: 'bg-cyan-100 text-cyan-700',
  M20: 'bg-blue-100 text-blue-700',
  M25: 'bg-violet-100 text-violet-700',
  M30: 'bg-purple-100 text-purple-700',
  M35: 'bg-rose-100 text-rose-700',
  M40: 'bg-orange-100 text-orange-700',
};

const GRADES = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40'];

export default function RMCSalesTable({ onRefresh }: { onRefresh: () => void }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  // Filters
  const [month, setMonth] = useState('');
  const [grade, setGrade] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [months, setMonths] = useState<string[]>([]);

  // Print modal
  const [printSale, setPrintSale] = useState<Sale | null>(null);

  // Edit modal
  const [editRow, setEditRow] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState<Partial<Sale>>({});
  const [saving, setSaving] = useState(false);

  const limit = 50;

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (month) p.set('month', month);
    if (grade) p.set('grade', grade);
    if (status) p.set('status', status);
    if (search) p.set('search', search);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    p.set('page', String(page));
    p.set('limit', String(limit));
    try {
      const res = await fetch('/api/rmc/sales?' + p.toString());
      const data: SalesResponse = await res.json();
      setSales(data.data);
      setTotal(data.total);

      // Collect months for filter dropdown
      if (!month && !grade && !status && !search && !dateFrom && !dateTo && page === 1) {
        const monthRes = await fetch('/api/rmc/sales?limit=1000');
        const all: SalesResponse = await monthRes.json();
        const seen = new Set<string>();
        for (const s of all.data) if (s.month_label) seen.add(s.month_label);
        setMonths([...seen].sort().reverse());
      }
    } finally {
      setLoading(false);
    }
  }, [month, grade, status, search, dateFrom, dateTo, page]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const cycleStatus = async (sale: Sale) => {
    const next = STATUS_CYCLE[sale.status] || 'CLOSED';
    await fetch(`/api/rmc/sales/${sale.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    fetchSales();
    onRefresh();
  };

  const deleteSale = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/rmc/sales/${id}`, { method: 'DELETE' });
    fetchSales();
    onRefresh();
  };

  const openEdit = (sale: Sale) => {
    setEditRow(sale);
    setEditForm({ ...sale });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    await fetch(`/api/rmc/sales/${editRow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    setEditRow(null);
    fetchSales();
    onRefresh();
  };

  const exportCSV = () => {
    const p = new URLSearchParams();
    if (month) p.set('month', month);
    if (grade) p.set('grade', grade);
    if (status) p.set('status', status);
    if (search) p.set('search', search);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    window.open('/api/rmc/export?' + p.toString());
  };

  const totalPages = Math.ceil(total / limit);

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
          <select value={month} onChange={e => { setMonth(e.target.value); setPage(1); }} className={inputCls}>
            <option value="">All Months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Grade</label>
          <select value={grade} onChange={e => { setGrade(e.target.value); setPage(1); }} className={inputCls}>
            <option value="">All Grades</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={inputCls}>
            <option value="">All</option>
            <option>OPEN</option>
            <option>PENDING</option>
            <option>CLOSED</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className={inputCls} />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-slate-500 mb-1">Search Customer</label>
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Customer or site..."
            className={inputCls + ' w-full'}
          />
        </div>
        <button
          onClick={exportCSV}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
        >
          Export CSV
        </button>
        <span className="text-xs text-slate-500 self-center">{total} records</span>
      </div>

      {/* Table */}
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
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Pump</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Advance</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={14} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={14} className="text-center py-8 text-slate-400">No records found</td></tr>
              ) : sales.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{s.date}</td>
                  <td className="px-3 py-2 font-medium text-slate-700 max-w-32 truncate">{s.customer_name || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 max-w-28 truncate">{s.site_address || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${GRADE_COLOR[s.grade] || 'bg-slate-100 text-slate-700'}`}>
                      {s.grade}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-purple-600">{Number(s.quantity).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-500">{s.rate ? fmtCur(s.rate) : '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{fmtCur(s.amount)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-500">{s.pump_charge ? fmtCur(s.pump_charge) : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtCur(s.total_amount)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{fmtCur(s.advance)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${Number(s.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {fmtCur(s.balance)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{s.payment_mode || '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => cycleStatus(s)}
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold cursor-pointer ${STATUS_COLOR[s.status] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {s.status}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => setPrintSale(s)} className="text-xs text-slate-500 hover:underline cursor-pointer">Print</button>
                      <button onClick={() => openEdit(s)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                      <button onClick={() => deleteSale(s.id)} className="text-xs text-rose-400 hover:text-rose-600">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              ← Prev
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages} ({total} records)</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {printSale && (
        <PrintChallan
          sale={{
            module: 'rmc',
            id: printSale.id,
            date: printSale.date,
            customer_name: printSale.customer_name,
            site_address: printSale.site_address,
            grade: printSale.grade,
            quantity: printSale.quantity,
            rate: printSale.rate,
            amount: printSale.amount,
            pump_charge: printSale.pump_charge,
            total_amount: printSale.total_amount,
            advance: printSale.advance,
            balance: printSale.balance,
            payment_mode: printSale.payment_mode,
            notes: printSale.notes,
          }}
          onClose={() => setPrintSale(null)}
        />
      )}

      {/* Edit Modal */}
      {editRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Edit RMC Sale #{editRow.id}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { key: 'date', label: 'Date', type: 'date' },
                { key: 'customer_name', label: 'Customer', type: 'text' },
                { key: 'site_address', label: 'Site Address', type: 'text' },
                { key: 'quantity', label: 'Qty (m³)', type: 'number' },
                { key: 'rate', label: 'Rate', type: 'number' },
                { key: 'pump_charge', label: 'Pump Charge', type: 'number' },
                { key: 'advance', label: 'Advance', type: 'number' },
                { key: 'notes', label: 'Notes', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={String(editForm[f.key as keyof Sale] ?? '')}
                    onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Grade</label>
                {editForm.grade && !GRADES.includes(editForm.grade) ? (
                  <div className="flex gap-2">
                    <input value={editForm.grade}
                      onChange={e => setEditForm(prev => ({ ...prev, grade: e.target.value }))}
                      placeholder="Custom grade e.g. M45"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <button onClick={() => setEditForm(prev => ({ ...prev, grade: 'M20' }))}
                      className="text-xs text-slate-400 hover:text-slate-600 px-2">↩</button>
                  </div>
                ) : (
                  <select
                    value={String(editForm.grade || '')}
                    onChange={e => {
                      if (e.target.value === '__custom__') { setEditForm(prev => ({ ...prev, grade: '' })); return; }
                      setEditForm(prev => ({ ...prev, grade: e.target.value }));
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    <option value="__custom__">Other (type)...</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select
                  value={String(editForm.status || 'CLOSED')}
                  onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option>CLOSED</option>
                  <option>OPEN</option>
                  <option>PENDING</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Mode</label>
                <select
                  value={String(editForm.payment_mode || '')}
                  onChange={e => setEditForm(prev => ({ ...prev, payment_mode: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">—</option>
                  <option>CASH</option>
                  <option>NY A/C</option>
                  <option>MKL A/C</option>
                  <option>KMK A/C</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditRow(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
