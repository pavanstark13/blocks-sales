'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';

interface CementRow {
  id: number;
  date: string;
  month_label: string;
  entry_type: 'INWARD' | 'CONSUMPTION';
  vehicle_no: string | null;
  company: string | null;
  inward_total: number;
  cem1_qty: number;
  cem2_qty: number;
  cem3_qty: number;
  consumption_text: string | null;
  cem1_consumption: number;
  cem2_consumption: number;
  cem3_consumption: number;
  cem1_balance: number | null;
  cem2_balance: number | null;
  cem3_balance: number | null;
}

interface MonthSummary {
  month: string;
  inward_cem1: number; inward_cem2: number; inward_cem3: number;
  consumed_cem1: number; consumed_cem2: number; consumed_cem3: number;
}

const CEM_LABELS = ['OPC', 'GREEN PPC', 'GGBS'];
const CEM_COLORS = ['#3b82f6', '#22c55e', '#f59e0b'];
const CEM_BG    = ['bg-blue-50', 'bg-green-50', 'bg-amber-50'];
const CEM_BORDER = ['border-blue-400', 'border-green-400', 'border-amber-400'];
const CEM_TEXT  = ['text-blue-700', 'text-green-700', 'text-amber-700'];
const CEM_BADGE = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-amber-100 text-amber-700'];
const LOW_STOCK_MT = 10;

const MONTH_ORDER = ['APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC','JAN','FEB','MAR'];
function sortMonths(a: string, b: string) {
  const [aM, aY] = a.split('-');
  const [bM, bY] = b.split('-');
  const ay = parseInt(aY), by = parseInt(bY);
  if (ay !== by) return ay - by;
  return MONTH_ORDER.indexOf(aM) - MONTH_ORDER.indexOf(bM);
}

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toFixed(decimals);
}
function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

const today = new Date().toISOString().split('T')[0];

interface FormState {
  date: string;
  entry_type: 'INWARD' | 'CONSUMPTION';
  company: string;
  vehicle_no: string;
  cem1_qty: string;
  cem2_qty: string;
  cem3_qty: string;
  cem1_consumption: string;
  cem2_consumption: string;
  cem3_consumption: string;
  consumption_text: string;
}

const EMPTY_FORM: FormState = {
  date: today, entry_type: 'INWARD',
  company: '', vehicle_no: '',
  cem1_qty: '', cem2_qty: '', cem3_qty: '',
  cem1_consumption: '', cem2_consumption: '', cem3_consumption: '',
  consumption_text: '',
};

function MiniBarChart({ months, field1, field2, label1, label2, color1, color2 }: {
  months: MonthSummary[];
  field1: keyof MonthSummary;
  field2: keyof MonthSummary;
  label1: string; label2: string;
  color1: string; color2: string;
}) {
  const max = Math.max(...months.flatMap(m => [Number(m[field1]) || 0, Number(m[field2]) || 0]), 1);
  return (
    <div className="space-y-1">
      <div className="flex gap-4 text-xs mb-2">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color1 }} />{label1}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color2 }} />{label2}
        </span>
      </div>
      <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
        {months.map(m => (
          <div key={m.month} className="flex flex-col items-center gap-0.5 flex-shrink-0" style={{ minWidth: 32 }}>
            <div className="flex items-end gap-0.5 h-24">
              <div className="rounded-t w-3" style={{ height: `${((Number(m[field1]) || 0) / max) * 88}px`, background: color1, minHeight: 2 }} title={`${label1}: ${fmt(Number(m[field1]))}`} />
              <div className="rounded-t w-3" style={{ height: `${((Number(m[field2]) || 0) / max) * 88}px`, background: color2, minHeight: 2 }} title={`${label2}: ${fmt(Number(m[field2]))}`} />
            </div>
            <span className="text-[9px] text-gray-400 rotate-45 origin-left mt-1 ml-1 whitespace-nowrap">{m.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RMCCement() {
  const [rows, setRows] = useState<CementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'INWARD' | 'CONSUMPTION'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [activeChart, setActiveChart] = useState<0 | 1 | 2>(0);

  // Add/Edit form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/rmc/cement')
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
        if (!r.vehicle_no?.toLowerCase().includes(s) &&
            !r.company?.toLowerCase().includes(s) &&
            !r.date?.includes(s)) return false;
      }
      return true;
    });
  }, [rows, filter, selectedMonth, search]);

  const monthSummaries: MonthSummary[] = useMemo(() => {
    const map: Record<string, MonthSummary> = {};
    for (const r of rows) {
      if (!r.month_label) continue;
      if (!map[r.month_label]) map[r.month_label] = {
        month: r.month_label,
        inward_cem1: 0, inward_cem2: 0, inward_cem3: 0,
        consumed_cem1: 0, consumed_cem2: 0, consumed_cem3: 0,
      };
      const m = map[r.month_label];
      if (r.entry_type === 'INWARD') {
        m.inward_cem1 += r.cem1_qty || 0;
        m.inward_cem2 += r.cem2_qty || 0;
        m.inward_cem3 += r.cem3_qty || 0;
      } else {
        m.consumed_cem1 += r.cem1_consumption || 0;
        m.consumed_cem2 += r.cem2_consumption || 0;
        m.consumed_cem3 += r.cem3_consumption || 0;
      }
    }
    return Object.values(map).sort((a, b) => sortMonths(a.month, b.month));
  }, [rows]);

  const latestBalances = useMemo(() => {
    const withBalance = rows.filter(r => r.cem1_balance != null);
    if (!withBalance.length) return { cem1: 0, cem2: 0, cem3: 0 };
    const last = withBalance[withBalance.length - 1];
    return { cem1: last.cem1_balance ?? 0, cem2: last.cem2_balance ?? 0, cem3: last.cem3_balance ?? 0 };
  }, [rows]);

  const totals = useMemo(() => {
    const inward = rows.filter(r => r.entry_type === 'INWARD');
    const cons   = rows.filter(r => r.entry_type === 'CONSUMPTION');
    return {
      in1: inward.reduce((s, r) => s + (r.cem1_qty || 0), 0),
      in2: inward.reduce((s, r) => s + (r.cem2_qty || 0), 0),
      in3: inward.reduce((s, r) => s + (r.cem3_qty || 0), 0),
      c1: cons.reduce((s, r) => s + (r.cem1_consumption || 0), 0),
      c2: cons.reduce((s, r) => s + (r.cem2_consumption || 0), 0),
      c3: cons.reduce((s, r) => s + (r.cem3_consumption || 0), 0),
    };
  }, [rows]);

  const supplierTotals = useMemo(() => {
    const map: Record<string, { cem1: number; cem2: number; cem3: number; trips: number }> = {};
    for (const r of rows.filter(r => r.entry_type === 'INWARD' && r.company)) {
      const k = r.company!;
      if (!map[k]) map[k] = { cem1: 0, cem2: 0, cem3: 0, trips: 0 };
      map[k].cem1 += r.cem1_qty || 0;
      map[k].cem2 += r.cem2_qty || 0;
      map[k].cem3 += r.cem3_qty || 0;
      map[k].trips += 1;
    }
    return Object.entries(map).sort((a, b) => (b[1].cem1 + b[1].cem2 + b[1].cem3) - (a[1].cem1 + a[1].cem2 + a[1].cem3));
  }, [rows]);

  const lowStock = [latestBalances.cem1, latestBalances.cem2, latestBalances.cem3]
    .map((b, i) => ({ label: CEM_LABELS[i], bal: b }))
    .filter(x => x.bal < LOW_STOCK_MT && rows.length > 0);

  function setF(k: keyof FormState, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(r: CementRow) {
    setEditId(r.id);
    setForm({
      date: r.date,
      entry_type: r.entry_type,
      company: r.company || '',
      vehicle_no: r.vehicle_no || '',
      cem1_qty: r.cem1_qty ? String(r.cem1_qty) : '',
      cem2_qty: r.cem2_qty ? String(r.cem2_qty) : '',
      cem3_qty: r.cem3_qty ? String(r.cem3_qty) : '',
      cem1_consumption: r.cem1_consumption ? String(r.cem1_consumption) : '',
      cem2_consumption: r.cem2_consumption ? String(r.cem2_consumption) : '',
      cem3_consumption: r.cem3_consumption ? String(r.cem3_consumption) : '',
      consumption_text: r.consumption_text || '',
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
      company: form.company || undefined,
      vehicle_no: form.vehicle_no || undefined,
      cem1_qty: parseFloat(form.cem1_qty) || 0,
      cem2_qty: parseFloat(form.cem2_qty) || 0,
      cem3_qty: parseFloat(form.cem3_qty) || 0,
      cem1_consumption: parseFloat(form.cem1_consumption) || 0,
      cem2_consumption: parseFloat(form.cem2_consumption) || 0,
      cem3_consumption: parseFloat(form.cem3_consumption) || 0,
      consumption_text: form.consumption_text || undefined,
    };
    await fetch('/api/rmc/cement', {
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
    await fetch(`/api/rmc/cement?id=${id}`, { method: 'DELETE' });
    load();
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-full';

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
    <div className="p-3 space-y-4 max-w-5xl mx-auto">
      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-sm text-amber-800 font-medium">
            Low stock: {lowStock.map(x => `${x.label} (${fmt(x.bal)} MT)`).join(', ')} — reorder needed
          </span>
        </div>
      )}

      {/* Header with Add Entry button */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Cement Stock</h2>
        <button
          onClick={() => showForm ? setShowForm(false) : openAdd()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors cursor-pointer"
        >
          {showForm ? '✕ Cancel' : '+ Add Entry'}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {editId ? 'Edit Entry' : 'New Cement Entry'}
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
                  <option value="INWARD">Inward (received)</option>
                  <option value="CONSUMPTION">Consumption (used)</option>
                </select>
              </div>
            </div>

            {form.entry_type === 'INWARD' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Supplier / Company</label>
                    <input type="text" value={form.company} onChange={e => setF('company', e.target.value)} placeholder="e.g. ACC Cement" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Vehicle No.</label>
                    <input type="text" value={form.vehicle_no} onChange={e => setF('vehicle_no', e.target.value)} placeholder="e.g. MH12AB1234" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-blue-600 mb-1 font-medium">OPC (MT)</label>
                    <input type="number" step="0.01" value={form.cem1_qty} onChange={e => setF('cem1_qty', e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-green-600 mb-1 font-medium">PPC (MT)</label>
                    <input type="number" step="0.01" value={form.cem2_qty} onChange={e => setF('cem2_qty', e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-amber-600 mb-1 font-medium">GGBS (MT)</label>
                    <input type="number" step="0.01" value={form.cem3_qty} onChange={e => setF('cem3_qty', e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Consumption Details (batch/grade info)</label>
                  <input type="text" value={form.consumption_text} onChange={e => setF('consumption_text', e.target.value)} placeholder="e.g. M25 - 30 m³ pour" className={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-blue-600 mb-1 font-medium">OPC used (MT)</label>
                    <input type="number" step="0.01" value={form.cem1_consumption} onChange={e => setF('cem1_consumption', e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-green-600 mb-1 font-medium">PPC used (MT)</label>
                    <input type="number" step="0.01" value={form.cem2_consumption} onChange={e => setF('cem2_consumption', e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-amber-600 mb-1 font-medium">GGBS used (MT)</label>
                    <input type="number" step="0.01" value={form.cem3_consumption} onChange={e => setF('cem3_consumption', e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 cursor-pointer">
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

      {/* Stock summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'OPC',       in: totals.in1, con: totals.c1, bal: latestBalances.cem1 },
          { label: 'GREEN PPC', in: totals.in2, con: totals.c2, bal: latestBalances.cem2 },
          { label: 'GGBS',      in: totals.in3, con: totals.c3, bal: latestBalances.cem3 },
        ].map((c, i) => (
          <div key={c.label} className={`rounded-xl border-l-4 ${CEM_BORDER[i]} bg-white shadow-sm p-3`}>
            <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${CEM_TEXT[i]}`}>{c.label}</div>
            <div className="text-xl font-bold text-gray-800">
              {fmt(c.bal)} <span className="text-xs font-normal text-gray-400">MT</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              <span className="text-green-600">↑ {fmt(c.in)} in</span>
              {' · '}
              <span className="text-red-500">↓ {fmt(c.con)} used</span>
            </div>
            {c.bal < LOW_STOCK_MT && rows.length > 0 && (
              <div className="mt-1 text-[10px] text-amber-600 font-medium">⚠ Low stock</div>
            )}
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      {monthSummaries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Monthly Inward vs Consumption</h3>
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <button key={i} onClick={() => setActiveChart(i as 0|1|2)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${activeChart === i ? CEM_BADGE[i] : 'bg-gray-100 text-gray-500'}`}>
                  {['OPC','PPC','GGBS'][i]}
                </button>
              ))}
            </div>
          </div>
          <MiniBarChart
            months={monthSummaries}
            field1={(['inward_cem1','inward_cem2','inward_cem3'] as const)[activeChart]}
            field2={(['consumed_cem1','consumed_cem2','consumed_cem3'] as const)[activeChart]}
            label1="Inward (MT)" label2="Used (MT)"
            color1={CEM_COLORS[activeChart]} color2="#e5e7eb"
          />
        </div>
      )}

      {/* Supplier breakdown */}
      {supplierTotals.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Supplier Inward Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1 pr-3 font-medium">Supplier</th>
                  <th className="text-right pr-3 font-medium">Trips</th>
                  <th className="text-right pr-3 font-medium">OPC (MT)</th>
                  <th className="text-right pr-3 font-medium">PPC (MT)</th>
                  <th className="text-right font-medium">GGBS (MT)</th>
                </tr>
              </thead>
              <tbody>
                {supplierTotals.map(([name, v]) => (
                  <tr key={name} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-1.5 pr-3 font-medium text-gray-800">{name}</td>
                    <td className="text-right pr-3 text-gray-600">{v.trips}</td>
                    <td className="text-right pr-3 text-blue-600">{v.cem1 > 0 ? fmt(v.cem1) : '—'}</td>
                    <td className="text-right pr-3 text-green-600">{v.cem2 > 0 ? fmt(v.cem2) : '—'}</td>
                    <td className="text-right text-amber-600">{v.cem3 > 0 ? fmt(v.cem3) : '—'}</td>
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
                {f === 'ALL' ? 'All' : f === 'INWARD' ? 'Inward' : 'Consumption'}
              </button>
            ))}
          </div>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white cursor-pointer">
            {months.map(m => <option key={m} value={m}>{m === 'ALL' ? 'All months' : m}</option>)}
          </select>
          <input type="text" placeholder="Search vehicle / supplier…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-0.5 w-40" />
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm">No entries yet. Click &ldquo;Add Entry&rdquo; to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1 pr-2 font-medium">Date</th>
                  <th className="text-left pr-2 font-medium">Type</th>
                  <th className="text-left pr-2 font-medium">Supplier / Details</th>
                  <th className="text-left pr-2 font-medium">Vehicle</th>
                  <th className="text-right pr-2 font-medium text-blue-600">OPC</th>
                  <th className="text-right pr-2 font-medium text-green-600">PPC</th>
                  <th className="text-right pr-2 font-medium text-amber-600">GGBS</th>
                  <th className="text-right font-medium text-gray-400">Bal OPC</th>
                  <th className="pr-2"></th>
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
                    <td className="pr-2 text-gray-700 max-w-[140px] truncate">
                      {r.entry_type === 'INWARD'
                        ? (r.company || '—')
                        : <span className="text-gray-500">{r.consumption_text || '—'}</span>
                      }
                    </td>
                    <td className="pr-2 text-gray-500">{r.vehicle_no || '—'}</td>
                    <td className="text-right pr-2">
                      {r.entry_type === 'INWARD'
                        ? <span className="text-blue-600">{r.cem1_qty > 0 ? fmt(r.cem1_qty) : '—'}</span>
                        : <span className="text-red-500">{r.cem1_consumption > 0 ? `-${fmt(r.cem1_consumption)}` : '—'}</span>
                      }
                    </td>
                    <td className="text-right pr-2">
                      {r.entry_type === 'INWARD'
                        ? <span className="text-green-600">{r.cem2_qty > 0 ? fmt(r.cem2_qty) : '—'}</span>
                        : <span className="text-red-500">{r.cem2_consumption > 0 ? `-${fmt(r.cem2_consumption)}` : '—'}</span>
                      }
                    </td>
                    <td className="text-right pr-2">
                      {r.entry_type === 'INWARD'
                        ? <span className="text-amber-600">{r.cem3_qty > 0 ? fmt(r.cem3_qty) : '—'}</span>
                        : <span className="text-red-500">{r.cem3_consumption > 0 ? `-${fmt(r.cem3_consumption)}` : '—'}</span>
                      }
                    </td>
                    <td className="text-right pr-2 text-gray-400">{fmt(r.cem1_balance)}</td>
                    <td className="pr-1">
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
