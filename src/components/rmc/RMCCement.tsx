'use client';

import React, { useEffect, useState, useMemo } from 'react';

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
  inward_cem1: number;
  inward_cem2: number;
  inward_cem3: number;
  consumed_cem1: number;
  consumed_cem2: number;
  consumed_cem3: number;
}

const CEM_LABELS = ['OPC (CEM-1)', 'GREEN PPC (CEM-2)', 'GGBS (CEM-3)'];
const CEM_COLORS = ['#3b82f6', '#22c55e', '#f59e0b'];
const CEM_BG = ['bg-blue-50', 'bg-green-50', 'bg-amber-50'];
const CEM_BORDER = ['border-blue-400', 'border-green-400', 'border-amber-400'];
const CEM_TEXT = ['text-blue-700', 'text-green-700', 'text-amber-700'];
const CEM_BADGE = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-amber-100 text-amber-700'];

const MONTH_ORDER = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'];

function sortMonths(a: string, b: string) {
  // Format: "AUG-25", "SEP-25", ..., "JAN-26"
  const [aM, aY] = a.split('-');
  const [bM, bY] = b.split('-');
  const ay = parseInt(aY);
  const by = parseInt(bY);
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

// Minimal bar chart rendered with divs
function BarChart({ months, field1, field2, label1, label2, color1, color2 }: {
  months: MonthSummary[];
  field1: keyof MonthSummary;
  field2: keyof MonthSummary;
  label1: string;
  label2: string;
  color1: string;
  color2: string;
}) {
  const max = Math.max(...months.flatMap(m => [Number(m[field1]) || 0, Number(m[field2]) || 0]), 1);
  return (
    <div className="space-y-1">
      <div className="flex gap-4 text-xs mb-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: color1 }} />{label1}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: color2 }} />{label2}</span>
      </div>
      <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
        {months.map(m => (
          <div key={m.month} className="flex flex-col items-center gap-0.5 flex-shrink-0" style={{ minWidth: 32 }}>
            <div className="flex items-end gap-0.5 h-24">
              <div
                className="rounded-t w-3"
                style={{ height: `${((Number(m[field1]) || 0) / max) * 88}px`, background: color1, minHeight: 2 }}
                title={`${label1}: ${fmt(Number(m[field1]))}`}
              />
              <div
                className="rounded-t w-3"
                style={{ height: `${((Number(m[field2]) || 0) / max) * 88}px`, background: color2, minHeight: 2 }}
                title={`${label2}: ${fmt(Number(m[field2]))}`}
              />
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

  useEffect(() => {
    fetch('/api/rmc/cement')
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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

  // Current stock: last balance entries
  const latestBalances = useMemo(() => {
    const withBalance = rows.filter(r => r.cem1_balance != null);
    if (!withBalance.length) return { cem1: null, cem2: null, cem3: null };
    const last = withBalance[withBalance.length - 1];
    return { cem1: last.cem1_balance, cem2: last.cem2_balance, cem3: last.cem3_balance };
  }, [rows]);

  // Total inward / consumed all time
  const totals = useMemo(() => {
    const inward = rows.filter(r => r.entry_type === 'INWARD');
    const cons = rows.filter(r => r.entry_type === 'CONSUMPTION');
    return {
      in1: inward.reduce((s, r) => s + (r.cem1_qty || 0), 0),
      in2: inward.reduce((s, r) => s + (r.cem2_qty || 0), 0),
      in3: inward.reduce((s, r) => s + (r.cem3_qty || 0), 0),
      c1: cons.reduce((s, r) => s + (r.cem1_consumption || 0), 0),
      c2: cons.reduce((s, r) => s + (r.cem2_consumption || 0), 0),
      c3: cons.reduce((s, r) => s + (r.cem3_consumption || 0), 0),
    };
  }, [rows]);

  // Supplier breakdown
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

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="h-40 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-sm">No cement data found.</p>
        <p className="text-xs mt-1">Import cement records via <code>/api/rmc/import-cement?run=1</code></p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 max-w-5xl mx-auto">
      {/* Stock summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'OPC', key: 'cem1', in: totals.in1, con: totals.c1, bal: latestBalances.cem1 },
          { label: 'GREEN PPC', key: 'cem2', in: totals.in2, con: totals.c2, bal: latestBalances.cem2 },
          { label: 'GGBS', key: 'cem3', in: totals.in3, con: totals.c3, bal: latestBalances.cem3 },
        ].map((c, i) => (
          <div key={c.key} className={`rounded-xl border-l-4 ${CEM_BORDER[i]} bg-white shadow-sm p-3`}>
            <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${CEM_TEXT[i]}`}>{c.label}</div>
            <div className="text-xl font-bold text-gray-800">{fmt(c.bal)} <span className="text-xs font-normal text-gray-400">MT</span></div>
            <div className="text-xs text-gray-500 mt-1">
              <span className="text-green-600">↑ {fmt(c.in)} in</span>
              {' · '}
              <span className="text-red-500">↓ {fmt(c.con)} used</span>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly charts */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Monthly Inward vs Consumption</h3>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <button
                key={i}
                onClick={() => setActiveChart(i as 0 | 1 | 2)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${activeChart === i ? CEM_BADGE[i] : 'bg-gray-100 text-gray-500'}`}
              >
                {['OPC', 'PPC', 'GGBS'][i]}
              </button>
            ))}
          </div>
        </div>
        <BarChart
          months={monthSummaries}
          field1={(['inward_cem1', 'inward_cem2', 'inward_cem3'] as const)[activeChart]}
          field2={(['consumed_cem1', 'consumed_cem2', 'consumed_cem3'] as const)[activeChart]}
          label1="Inward (MT)"
          label2="Used (MT)"
          color1={CEM_COLORS[activeChart]}
          color2="#e5e7eb"
        />
      </div>

      {/* Supplier breakdown */}
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

      {/* Daily log */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Daily Log</h3>
          <div className="flex gap-1 ml-auto">
            {(['ALL', 'INWARD', 'CONSUMPTION'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                  filter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'ALL' ? 'All' : f === 'INWARD' ? 'Inward' : 'Consumption'}
              </button>
            ))}
          </div>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white cursor-pointer"
          >
            {months.map(m => <option key={m} value={m}>{m === 'ALL' ? 'All months' : m}</option>)}
          </select>
          <input
            type="text"
            placeholder="Search vehicle / supplier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-0.5 w-40"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-left py-1 pr-2 font-medium">Date</th>
                <th className="text-left pr-2 font-medium">Type</th>
                <th className="text-left pr-2 font-medium">Supplier / Details</th>
                <th className="text-left pr-2 font-medium">Vehicle</th>
                <th className="text-right pr-2 font-medium">OPC</th>
                <th className="text-right pr-2 font-medium">PPC</th>
                <th className="text-right font-medium">GGBS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-1.5 pr-2 text-gray-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="pr-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      r.entry_type === 'INWARD' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {r.entry_type === 'INWARD' ? 'IN' : 'OUT'}
                    </span>
                  </td>
                  <td className="pr-2 text-gray-700">
                    {r.entry_type === 'INWARD'
                      ? r.company || '—'
                      : <span className="text-gray-500">{r.consumption_text || '—'}</span>
                    }
                  </td>
                  <td className="pr-2 text-gray-500">{r.vehicle_no || '—'}</td>
                  <td className="text-right pr-2">
                    {r.entry_type === 'INWARD'
                      ? <span className="text-blue-600">{r.cem1_qty > 0 ? fmt(r.cem1_qty) : '—'}</span>
                      : <span className="text-red-500">{r.cem1_consumption > 0 ? fmt(r.cem1_consumption) : '—'}</span>
                    }
                  </td>
                  <td className="text-right pr-2">
                    {r.entry_type === 'INWARD'
                      ? <span className="text-green-600">{r.cem2_qty > 0 ? fmt(r.cem2_qty) : '—'}</span>
                      : <span className="text-red-500">{r.cem2_consumption > 0 ? fmt(r.cem2_consumption) : '—'}</span>
                    }
                  </td>
                  <td className="text-right">
                    {r.entry_type === 'INWARD'
                      ? <span className="text-amber-600">{r.cem3_qty > 0 ? fmt(r.cem3_qty) : '—'}</span>
                      : <span className="text-red-500">{r.cem3_consumption > 0 ? fmt(r.cem3_consumption) : '—'}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p className="text-xs text-gray-400 text-center pt-2">Showing 200 of {filtered.length} records</p>
          )}
        </div>
      </div>
    </div>
  );
}
