'use client';

import { useEffect, useState, useCallback } from 'react';

interface StockRow { size: number; produced: number; dispatched: number; available: number; }
interface Entry    { id: number; date: string; size: number; quantity: number; notes: string; }
interface DaySummary { date: string; qty_4: number; qty_6: number; qty_8: number; total: number; }

function fmt(n: number) { return new Intl.NumberFormat('en-IN').format(n); }

const today = new Date().toISOString().split('T')[0];
const SIZE_COLOR: Record<number, string> = {
  4: 'bg-blue-600', 6: 'bg-emerald-600', 8: 'bg-amber-500',
};

export default function Stock() {
  const [stock, setStock]     = useState<StockRow[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  // Entry form
  const [entryDate, setEntryDate]   = useState(today);
  const [entrySize, setEntrySize]   = useState('6');
  const [entryQty,  setEntryQty]    = useState('');
  const [entryNote, setEntryNote]   = useState('');
  const [saving,    setSaving]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const data = await fetch('/api/production?' + params).then(r => r.json());
    setStock(data.stock);
    setEntries(data.entries);
    setSummary(data.summary);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryQty || parseInt(entryQty) <= 0) return;
    setSaving(true);
    await fetch('/api/production', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: entryDate, size: parseInt(entrySize), quantity: parseInt(entryQty), notes: entryNote || undefined }),
    });
    setEntryQty('');
    setEntryNote('');
    setSaving(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this production entry?')) return;
    await fetch(`/api/production?id=${id}`, { method: 'DELETE' });
    load();
  };

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-6">
      {/* Stock summary cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Current Stock (All Time)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[4, 6, 8].map(size => {
            const row = stock.find(s => s.size === size) || { produced: 0, dispatched: 0, available: 0 };
            const pct = row.produced > 0 ? Math.round((row.dispatched / row.produced) * 100) : 0;
            return (
              <div key={size} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className={`${SIZE_COLOR[size]} text-white text-xs font-bold px-2.5 py-1 rounded-lg`}>{size}&quot; Block</span>
                  <span className={`text-lg font-bold ${row.available > 0 ? 'text-emerald-600' : row.available < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {fmt(row.available)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  <span className="text-slate-700 font-medium">{fmt(row.produced)}</span> produced ·{' '}
                  <span className="text-slate-700 font-medium">{fmt(row.dispatched)}</span> dispatched
                </p>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${SIZE_COLOR[size]} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{pct}% dispatched</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add production entry */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Record Production</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Date</label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={`w-full ${inputCls}`} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Size</label>
                <select value={entrySize} onChange={e => setEntrySize(e.target.value)} className={`w-full ${inputCls}`}>
                  <option value="4">4&quot;</option>
                  <option value="6">6&quot;</option>
                  <option value="8">8&quot;</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Quantity</label>
                <input type="number" placeholder="e.g. 2000" value={entryQty}
                  onChange={e => setEntryQty(e.target.value)} className={`w-full ${inputCls}`} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
              <input type="text" placeholder="Shift 1, batch no., etc." value={entryNote}
                onChange={e => setEntryNote(e.target.value)} className={`w-full ${inputCls}`} />
            </div>
            <button type="submit" disabled={saving || !entryQty}
              className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {saving ? 'Saving...' : '+ Add Production Entry'}
            </button>
          </form>
        </div>

        {/* Daily production summary */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-end">
            <h3 className="text-sm font-semibold text-slate-700 self-center">Production History</h3>
            <div className="flex gap-2 ml-auto">
              <div>
                <label className="block text-xs text-slate-500 mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-xs text-slate-500 font-semibold text-left">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2 text-right text-blue-600">4&quot;</th>
                    <th className="px-4 py-2 text-right text-emerald-600">6&quot;</th>
                    <th className="px-4 py-2 text-right text-amber-600">8&quot;</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {summary.map(d => (
                    <tr key={d.date} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-600">{d.date}</td>
                      <td className="px-4 py-2 text-right text-blue-700">{d.qty_4 ? fmt(d.qty_4) : '—'}</td>
                      <td className="px-4 py-2 text-right text-emerald-700">{d.qty_6 ? fmt(d.qty_6) : '—'}</td>
                      <td className="px-4 py-2 text-right text-amber-700">{d.qty_8 ? fmt(d.qty_8) : '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmt(d.total)}</td>
                    </tr>
                  ))}
                  {summary.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No production entries yet</td></tr>
                  )}
                </tbody>
                {summary.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200 sticky bottom-0">
                    <tr className="text-xs font-semibold">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2 text-right text-blue-700">{fmt(summary.reduce((s, d) => s + d.qty_4, 0))}</td>
                      <td className="px-4 py-2 text-right text-emerald-700">{fmt(summary.reduce((s, d) => s + d.qty_6, 0))}</td>
                      <td className="px-4 py-2 text-right text-amber-700">{fmt(summary.reduce((s, d) => s + d.qty_8, 0))}</td>
                      <td className="px-4 py-2 text-right">{fmt(summary.reduce((s, d) => s + d.total, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Raw production entries */}
      {entries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">All Entries</h3>
            <span className="text-xs text-slate-400">{entries.length} records</span>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 text-xs text-slate-500">
                <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-right">Size</th>
                  <th className="px-4 py-2 text-right">Quantity</th><th className="px-4 py-2">Notes</th><th className="px-4 py-2"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-1.5 text-slate-500">{e.date}</td>
                    <td className="px-4 py-1.5 text-right">{e.size}&quot;</td>
                    <td className="px-4 py-1.5 text-right font-medium">{fmt(e.quantity)}</td>
                    <td className="px-4 py-1.5 text-slate-400 text-xs">{e.notes || '—'}</td>
                    <td className="px-4 py-1.5">
                      <button onClick={() => handleDelete(e.id)} className="text-xs text-slate-300 hover:text-red-500">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
