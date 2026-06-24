'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';

interface CementRow {
  id: number;
  date: string;
  month_label: string;
  entry_type: 'INWARD' | 'CONSUMPTION';
  supplier: string | null;
  vehicle_no: string | null;
  bags: number;
  price_per_bag: number;
  total_cost: number;
  bags_consumed: number;
  consumption_note: string | null;
  balance_bags: number;
  notes: string | null;
}

interface MonthSummary {
  month: string;
  bags_in: number;
  bags_out: number;
  cost: number;
}

const MONTH_ORDER = ['APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC','JAN','FEB','MAR'];
function sortMonths(a: string, b: string) {
  const [aM, aY] = a.split('-');
  const [bM, bY] = b.split('-');
  const ay = parseInt(aY), by = parseInt(bY);
  if (ay !== by) return ay - by;
  return MONTH_ORDER.indexOf(aM) - MONTH_ORDER.indexOf(bM);
}

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
function fmtNum(n: number) { return new Intl.NumberFormat('en-IN').format(n); }
function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

const today = new Date().toISOString().split('T')[0];
const LOW_STOCK_BAGS = 100;

interface FormState {
  date: string;
  entry_type: 'INWARD' | 'CONSUMPTION';
  supplier: string;
  vehicle_no: string;
  bags: string;
  price_per_bag: string;
  bags_consumed: string;
  consumption_note: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  date: today, entry_type: 'INWARD',
  supplier: '', vehicle_no: '',
  bags: '', price_per_bag: '',
  bags_consumed: '', consumption_note: '', notes: '',
};

function BarChart({ months }: { months: MonthSummary[] }) {
  const maxIn  = Math.max(...months.map(m => m.bags_in),  1);
  const maxOut = Math.max(...months.map(m => m.bags_out), 1);
  const max = Math.max(maxIn, maxOut);
  return (
    <div>
      <div className="flex gap-4 text-xs mb-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-blue-500" />Bags In</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-red-300" />Bags Used</span>
      </div>
      <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
        {months.map(m => (
          <div key={m.month} className="flex flex-col items-center gap-0.5 flex-shrink-0" style={{ minWidth: 36 }}>
            <div className="flex items-end gap-0.5 h-24">
              <div className="rounded-t w-3.5 bg-blue-500"
                style={{ height: `${(m.bags_in / max) * 88}px`, minHeight: 2 }}
                title={`In: ${fmtNum(m.bags_in)} bags`} />
              <div className="rounded-t w-3.5 bg-red-300"
                style={{ height: `${(m.bags_out / max) * 88}px`, minHeight: 2 }}
                title={`Used: ${fmtNum(m.bags_out)} bags`} />
            </div>
            <span className="text-[9px] text-gray-400 rotate-45 origin-left mt-1 ml-1 whitespace-nowrap">{m.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BlocksCement() {
  const [rows, setRows] = useState<CementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'INWARD' | 'CONSUMPTION'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/cement')
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => {
    const set = new Set(rows.map(r => r.month_label).filter(Boolean));
    return ['ALL', ...[...set].sort(sortMonths)];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter !== 'ALL' && r.entry_type !== filter) return false;
      if (selectedMonth !== 'ALL' && r.month_label !== selectedMonth) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.supplier?.toLowerCase().includes(s) &&
            !r.vehicle_no?.toLowerCase().includes(s) &&
            !r.consumption_note?.toLowerCase().includes(s) &&
            !r.date?.includes(s)) return false;
      }
      return true;
    });
  }, [rows, filter, selectedMonth, search]);

  const monthSummaries: MonthSummary[] = useMemo(() => {
    const map: Record<string, MonthSummary> = {};
    for (const r of rows) {
      if (!r.month_label) continue;
      if (!map[r.month_label]) map[r.month_label] = { month: r.month_label, bags_in: 0, bags_out: 0, cost: 0 };
      if (r.entry_type === 'INWARD') {
        map[r.month_label].bags_in  += r.bags || 0;
        map[r.month_label].cost     += r.total_cost || 0;
      } else {
        map[r.month_label].bags_out += r.bags_consumed || 0;
      }
    }
    return Object.values(map).sort((a, b) => sortMonths(a.month, b.month));
  }, [rows]);

  const totals = useMemo(() => {
    const inward = rows.filter(r => r.entry_type === 'INWARD');
    const cons   = rows.filter(r => r.entry_type === 'CONSUMPTION');
    return {
      bags_in:   inward.reduce((s, r) => s + (r.bags || 0), 0),
      total_cost: inward.reduce((s, r) => s + (r.total_cost || 0), 0),
      bags_out:  cons.reduce((s, r) => s + (r.bags_consumed || 0), 0),
    };
  }, [rows]);

  const currentBalance = useMemo(() => {
    const withBal = rows.filter(r => r.balance_bags != null);
    return withBal.length ? withBal[withBal.length - 1].balance_bags : 0;
  }, [rows]);

  const avgDailyConsumption = useMemo(() => {
    if (monthSummaries.length === 0) return 0;
    const totalDays = monthSummaries.length * 30;
    return totals.bags_out / Math.max(totalDays, 1);
  }, [monthSummaries, totals]);

  const daysRemaining = avgDailyConsumption > 0 ? Math.floor(currentBalance / avgDailyConsumption) : null;

  const supplierSummary = useMemo(() => {
    const map: Record<string, { bags: number; cost: number; trips: number }> = {};
    for (const r of rows.filter(r => r.entry_type === 'INWARD' && r.supplier)) {
      const k = r.supplier!;
      if (!map[k]) map[k] = { bags: 0, cost: 0, trips: 0 };
      map[k].bags  += r.bags || 0;
      map[k].cost  += r.total_cost || 0;
      map[k].trips += 1;
    }
    return Object.entries(map).sort((a, b) => b[1].bags - a[1].bags);
  }, [rows]);

  function setF(k: keyof FormState, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM, date: today });
    setShowForm(true);
  }

  function openEdit(r: CementRow) {
    setEditId(r.id);
    setForm({
      date: r.date,
      entry_type: r.entry_type,
      supplier: r.supplier || '',
      vehicle_no: r.vehicle_no || '',
      bags: r.bags ? String(r.bags) : '',
      price_per_bag: r.price_per_bag ? String(r.price_per_bag) : '',
      bags_consumed: r.bags_consumed ? String(r.bags_consumed) : '',
      consumption_note: r.consumption_note || '',
      notes: r.notes || '',
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...(editId ? { id: editId } : {}),
      date: form.date,
      entry_type: form.entry_type,
      supplier: form.supplier || undefined,
      vehicle_no: form.vehicle_no || undefined,
      bags: parseInt(form.bags) || 0,
      price_per_bag: parseFloat(form.price_per_bag) || 0,
      bags_consumed: parseInt(form.bags_consumed) || 0,
      consumption_note: form.consumption_note || undefined,
      notes: form.notes || undefined,
    };
    await fetch('/api/cement', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this cement entry?')) return;
    await fetch(`/api/cement?id=${id}`, { method: 'DELETE' });
    load();
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full';

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="h-40 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Low stock alert */}
      {currentBalance < LOW_STOCK_BAGS && rows.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-sm text-amber-800 font-medium">
            Low cement stock — only {fmtNum(currentBalance)} bags remaining. Reorder soon!
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Cement Stock (OPC)</h2>
        <button
          onClick={() => showForm ? setShowForm(false) : openAdd()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
        >
          {showForm ? '✕ Cancel' : '+ Add Entry'}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {editId ? 'Edit Cement Entry' : 'New Cement Entry'}
          </h3>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => setF('date', e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entry Type</label>
                <select value={form.entry_type} onChange={e => setF('entry_type', e.target.value as 'INWARD' | 'CONSUMPTION')} className={inputCls}>
                  <option value="INWARD">Inward (bags received)</option>
                  <option value="CONSUMPTION">Consumption (bags used)</option>
                </select>
              </div>
            </div>

            {form.entry_type === 'INWARD' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Supplier</label>
                    <input type="text" value={form.supplier} onChange={e => setF('supplier', e.target.value)} placeholder="e.g. ACC, Ultratech" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Vehicle No.</label>
                    <input type="text" value={form.vehicle_no} onChange={e => setF('vehicle_no', e.target.value)} placeholder="e.g. MH12AB1234" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bags Received (50 kg bags)</label>
                    <input type="number" value={form.bags} onChange={e => setF('bags', e.target.value)} placeholder="e.g. 200" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Price per Bag (₹)</label>
                    <input type="number" step="0.01" value={form.price_per_bag} onChange={e => setF('price_per_bag', e.target.value)} placeholder="e.g. 380" className={inputCls} />
                  </div>
                </div>
                {form.bags && form.price_per_bag && (
                  <p className="text-xs text-blue-600 font-medium">
                    Total cost: {fmtINR((parseInt(form.bags) || 0) * (parseFloat(form.price_per_bag) || 0))}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bags Used</label>
                    <input type="number" value={form.bags_consumed} onChange={e => setF('bags_consumed', e.target.value)} placeholder="e.g. 50" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">For which size / shift</label>
                    <input type="text" value={form.consumption_note} onChange={e => setF('consumption_note', e.target.value)} placeholder='e.g. 6" blocks, shift 1' className={inputCls} />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
              <input type="text" value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Any additional notes" className={inputCls} />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {saving ? 'Saving…' : editId ? 'Update Entry' : 'Add Entry'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 cursor-pointer">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border-l-4 border-blue-500 shadow-sm p-3">
          <div className="text-xs text-gray-500 mb-1">Current Stock</div>
          <div className="text-2xl font-bold text-blue-700">{fmtNum(currentBalance)}</div>
          <div className="text-xs text-gray-400">bags ({(currentBalance * 50 / 1000).toFixed(1)} MT)</div>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-green-500 shadow-sm p-3">
          <div className="text-xs text-gray-500 mb-1">Total Received</div>
          <div className="text-2xl font-bold text-green-700">{fmtNum(totals.bags_in)}</div>
          <div className="text-xs text-gray-400">bags all time</div>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-red-400 shadow-sm p-3">
          <div className="text-xs text-gray-500 mb-1">Total Consumed</div>
          <div className="text-2xl font-bold text-red-600">{fmtNum(totals.bags_out)}</div>
          <div className="text-xs text-gray-400">bags all time</div>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-amber-500 shadow-sm p-3">
          <div className="text-xs text-gray-500 mb-1">Total Cost</div>
          <div className="text-lg font-bold text-amber-700">{fmtINR(totals.total_cost)}</div>
          <div className="text-xs text-gray-400">
            {daysRemaining != null ? `~${daysRemaining} days remaining` : 'avg. consumption'}
          </div>
        </div>
      </div>

      {/* Monthly chart */}
      {monthSummaries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Inward vs Consumption</h3>
          <BarChart months={monthSummaries} />
        </div>
      )}

      {/* Supplier summary */}
      {supplierSummary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Supplier Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1 pr-3 font-medium">Supplier</th>
                  <th className="text-right pr-3 font-medium">Trips</th>
                  <th className="text-right pr-3 font-medium">Bags</th>
                  <th className="text-right font-medium">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {supplierSummary.map(([name, v]) => (
                  <tr key={name} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-1.5 pr-3 font-medium text-gray-800">{name}</td>
                    <td className="text-right pr-3 text-gray-600">{v.trips}</td>
                    <td className="text-right pr-3 text-blue-600">{fmtNum(v.bags)}</td>
                    <td className="text-right text-amber-700">{fmtINR(v.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily log */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Daily Log</h3>
          <div className="flex gap-1 ml-auto">
            {(['ALL','INWARD','CONSUMPTION'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                  filter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {f === 'ALL' ? 'All' : f === 'INWARD' ? 'Inward' : 'Used'}
              </button>
            ))}
          </div>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white cursor-pointer">
            {months.map(m => <option key={m} value={m}>{m === 'ALL' ? 'All months' : m}</option>)}
          </select>
          <input type="text" placeholder="Search supplier…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-0.5 w-36" />
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm">No cement entries yet. Click &ldquo;Add Entry&rdquo; to start tracking.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1 pr-2 font-medium">Date</th>
                  <th className="text-left pr-2 font-medium">Type</th>
                  <th className="text-left pr-2 font-medium">Supplier / Note</th>
                  <th className="text-left pr-2 font-medium">Vehicle</th>
                  <th className="text-right pr-2 font-medium">Bags</th>
                  <th className="text-right pr-2 font-medium">Price/Bag</th>
                  <th className="text-right pr-2 font-medium">Cost</th>
                  <th className="text-right pr-2 font-medium text-blue-600">Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 group">
                    <td className="py-1.5 pr-2 text-gray-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="pr-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        r.entry_type === 'INWARD' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {r.entry_type === 'INWARD' ? 'IN' : 'OUT'}
                      </span>
                    </td>
                    <td className="pr-2 text-gray-700 max-w-[130px] truncate">
                      {r.entry_type === 'INWARD' ? (r.supplier || '—') : (r.consumption_note || '—')}
                    </td>
                    <td className="pr-2 text-gray-500">{r.vehicle_no || '—'}</td>
                    <td className="text-right pr-2 font-medium">
                      {r.entry_type === 'INWARD'
                        ? <span className="text-green-700">+{fmtNum(r.bags)}</span>
                        : <span className="text-red-600">-{fmtNum(r.bags_consumed)}</span>
                      }
                    </td>
                    <td className="text-right pr-2 text-gray-500">
                      {r.entry_type === 'INWARD' && r.price_per_bag > 0 ? `₹${r.price_per_bag}` : '—'}
                    </td>
                    <td className="text-right pr-2 text-amber-700">
                      {r.entry_type === 'INWARD' && r.total_cost > 0 ? fmtINR(r.total_cost) : '—'}
                    </td>
                    <td className="text-right pr-2 text-blue-700 font-medium">{fmtNum(r.balance_bags)}</td>
                    <td>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(r)}
                          className="text-[10px] text-blue-500 hover:text-blue-700 cursor-pointer px-1">edit</button>
                        <button onClick={() => handleDelete(r.id)}
                          className="text-[10px] text-red-400 hover:text-red-600 cursor-pointer px-1">del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <p className="text-xs text-gray-400 text-center pt-2">Showing 200 of {filtered.length} records</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
