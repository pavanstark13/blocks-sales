'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import AIInsights from './AIInsights';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonthRow {
  month_label: string; first_date: string; last_date: string;
  orders: number; customers: number; total_qty: number;
  revenue: number; outstanding: number; collected: number;
  collection_rate: number; aov: number;
  qty_4: number; qty_6: number; qty_8: number;
  rev_4: number; rev_6: number; rev_8: number;
  mom_revenue: number | null; mom_volume: number | null;
  mom_qty4: number | null; mom_qty6: number | null; mom_qty8: number | null;
}
interface SizeRow { size: number; volume: number; revenue: number; orders: number; avg_rate: number; customers: number; }
interface CustomerRow {
  customer_name: string; volume: number; revenue: number; outstanding: number;
  orders: number; active_months: number; last_delivery: string;
  qty_4: number; qty_6: number; qty_8: number;
}
interface AgeingRow { d0_15: number; d16_30: number; d31_60: number; d61_90: number; d90plus: number; customers_with_due: number; }
interface Stats {
  total_volume: number; total_revenue: number; total_outstanding: number;
  total_orders: number; total_customers: number;
  avg_order_value: number; first_date: string; last_date: string;
  total_qty_4: number; total_qty_6: number; total_qty_8: number;
}
interface ReportData {
  stats: Stats; monthly: MonthRow[]; sizes: SizeRow[];
  top_customers: CustomerRow[]; ageing: AgeingRow;
  concentration: { top3_pct: number; top5_pct: number };
  customer_health: { inactive: number; at_risk: number; total: number };
  dso: { avg_invoice_age: number; dso_estimate: number };
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtL = (n: number) => {
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n/1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};
const fmtN = (n: number) => n.toLocaleString('en-IN');
const fmtCur = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

// ── Constants ─────────────────────────────────────────────────────────────────

const SIZE_COLORS = { 4: '#3b82f6', 6: '#8b5cf6', 8: '#f59e0b' } as Record<number, string>;
const CHART_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#a78bfa','#34d399'];

// ── Sub-components ────────────────────────────────────────────────────────────

function MoM({ val }: { val: number | null }) {
  if (val === null) return <span className="text-slate-300 text-[10px]">—</span>;
  const color = val > 0 ? 'text-emerald-600' : val < 0 ? 'text-red-500' : 'text-slate-400';
  return <span className={`text-[10px] font-bold ${color}`}>{val > 0 ? '▲' : val < 0 ? '▼' : ''}  {Math.abs(val)}%</span>;
}

function RAGDot({ val, good = 'high' }: { val: number; good?: 'high' | 'low' }) {
  const isGood = good === 'high' ? val >= 80 : val <= 30;
  const isMid  = good === 'high' ? val >= 50 : val <= 60;
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${isGood ? 'bg-emerald-500' : isMid ? 'bg-amber-400' : 'bg-red-500'}`} />
  );
}

function KPICard({ label, value, sub, trend, color, icon, rag }: {
  label: string; value: string; sub?: string; trend?: number | null;
  color: string; icon: React.ReactNode; rag?: { val: number; good: 'high' | 'low' };
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight">{value}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {sub && <p className="text-xs text-slate-400">{sub}</p>}
            {trend !== undefined && trend !== null && <MoM val={trend} />}
            {rag && <><RAGDot val={rag.val} good={rag.good} /><span className="text-[10px] text-slate-400">{rag.val}%</span></>}
          </div>
        </div>
        <div className="text-slate-200 ml-2 flex-shrink-0">{icon}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h3>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BlocksReport() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState({ from: '', to: '' });
  const [chartTab, setChartTab] = useState<'revenue' | 'volume' | 'size-mix'>('revenue');
  const [tableView, setTableView] = useState<'qty' | 'revenue'>('qty');

  const fetchReport = (from: string, to: string) => {
    setLoading(true);
    const params = from && to ? `?from=${from}&to=${to}` : '';
    fetch(`/api/report${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchReport('', ''); }, []);

  const currentMonth = useMemo(() => data?.monthly?.[data.monthly.length - 1] ?? null, [data]);
  const prevMonth    = useMemo(() => data?.monthly?.[data.monthly.length - 2] ?? null, [data]);
  const ageingTotal  = useMemo(() => {
    if (!data?.ageing) return 0;
    return (data.ageing.d0_15||0)+(data.ageing.d16_30||0)+(data.ageing.d31_60||0)+(data.ageing.d61_90||0)+(data.ageing.d90plus||0);
  }, [data]);
  const collRate = useMemo(() => {
    if (!data?.stats) return 0;
    const s = data.stats;
    return s.total_revenue > 0 ? Math.round(((s.total_revenue - s.total_outstanding) / s.total_revenue) * 100) : 0;
  }, [data]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Month','Total Qty','4" Qty','6" Qty','8" Qty','Revenue','4" Rev','6" Rev','8" Rev','Outstanding','Coll%','Orders','Customers','MoM Rev%'],
      ...data.monthly.map(m => [m.month_label,m.total_qty,m.qty_4,m.qty_6,m.qty_8,m.revenue,m.rev_4,m.rev_6,m.rev_8,m.outstanding,m.collection_rate+'%',m.orders,m.customers,m.mom_revenue !== null ? m.mom_revenue+'%' : '']),
    ];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'blocks-report.csv'; a.click();
  };

  if (loading) return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0,1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}</div>
      <div className="grid grid-cols-3 gap-3">{[0,1,2].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl" />)}</div>
      <div className="h-72 bg-slate-100 rounded-xl" /><div className="h-64 bg-slate-100 rounded-xl" />
    </div>
  );
  if (!data) return <div className="p-8 text-center text-slate-400">No report data.</div>;

  const { stats, monthly, sizes, top_customers, ageing, concentration, customer_health, dso } = data;
  const revPeriod = applied.from ? `${applied.from} → ${applied.to}` : `${stats.first_date ?? ''} to ${stats.last_date ?? ''}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-3">

      {/* ── Filter & Export bar ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setApplied(dateRange); fetchReport(dateRange.from, dateRange.to); }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium cursor-pointer">Apply</button>
          {(applied.from || applied.to) && (
            <button onClick={() => { setDateRange({ from:'',to:'' }); setApplied({ from:'',to:'' }); fetchReport('',''); }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">Clear</button>
          )}
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 cursor-pointer font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
        <p className="text-xs text-slate-400 ml-auto">{revPeriod}</p>
      </div>

      {/* ── Executive KPI Row ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Executive Summary" sub="all-time performance" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Total Revenue" value={fmtL(stats.total_revenue)} sub={`${fmtN(stats.total_orders)} orders`}
            trend={currentMonth?.mom_revenue ?? null} color="border-l-blue-500"
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <KPICard label="Total Volume" value={fmtN(stats.total_volume)} sub="blocks sold"
            trend={currentMonth?.mom_volume ?? null} color="border-l-violet-500"
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} />
          <KPICard label="Outstanding" value={fmtL(stats.total_outstanding)}
            rag={{ val: collRate, good: 'high' }} color="border-l-rose-500"
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
          <KPICard label="Avg Order Value" value={fmtCur(stats.avg_order_value)} sub="per invoice"
            color="border-l-emerald-500"
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>} />
          <KPICard label="DSO" value={`${Math.min(dso?.dso_estimate ?? 0, 365)} days`}
            sub="days sales outstanding" color="border-l-amber-500"
            rag={{ val: Math.min(dso?.dso_estimate ?? 0, 100), good: 'low' }}
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <KPICard label="Active Customers" value={String(stats.total_customers)}
            sub={`${customer_health.at_risk} at-risk · ${customer_health.inactive} inactive`}
            color="border-l-cyan-500"
            icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        </div>
      </section>

      {/* ── Size Performance Cards ─────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Product Size Performance" sub="quantity sold by block size" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[4, 6, 8].map(sz => {
            const sizeData = sizes.find(s => s.size === sz);
            const totalVol = sizes.reduce((s, r) => s + r.volume, 0);
            const pct = totalVol > 0 && sizeData ? Math.round((sizeData.volume / totalVol) * 100) : 0;
            const curQty   = currentMonth ? (sz === 4 ? currentMonth.qty_4 : sz === 6 ? currentMonth.qty_6 : currentMonth.qty_8) : 0;
            const prevQty  = prevMonth    ? (sz === 4 ? prevMonth.qty_4    : sz === 6 ? prevMonth.qty_6    : prevMonth.qty_8) : 0;
            const curRev   = currentMonth ? (sz === 4 ? currentMonth.rev_4 : sz === 6 ? currentMonth.rev_6 : currentMonth.rev_8) : 0;
            const mom      = prevQty > 0 ? Math.round(((curQty - prevQty) / prevQty) * 100) : null;
            const color    = SIZE_COLORS[sz];
            return (
              <div key={sz} className="bg-white rounded-xl shadow-sm p-4 border-t-4" style={{ borderTopColor: color }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-2xl font-black text-slate-800">{sz}"</span>
                    <span className="text-sm text-slate-400 ml-1">Block</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full text-white" style={{ background: color }}>
                    {pct}% of total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-slate-400">All-time Volume</p>
                    <p className="text-lg font-bold text-slate-700">{fmtN(sizeData?.volume ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">All-time Revenue</p>
                    <p className="text-lg font-bold text-slate-700">{fmtL(sizeData?.revenue ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">This Month</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-base font-bold text-slate-700">{fmtN(curQty)}</p>
                      <MoM val={mom} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">This Month Rev</p>
                    <p className="text-base font-bold text-slate-700">{fmtL(curRev)}</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Avg Rate</span>
                  <span className="font-medium text-slate-600">₹{sizeData?.avg_rate ?? 0}/pc</span>
                </div>
                {/* Mini bar showing this month vs prev month */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-16">This month</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width:`${Math.min(curQty/(Math.max(curQty,prevQty)||1)*100,100)}%`, background: color }} />
                    </div>
                    <span className="w-12 text-right font-medium text-slate-600">{fmtN(curQty)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-16">Last month</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full bg-slate-300" style={{ width:`${Math.min(prevQty/(Math.max(curQty,prevQty)||1)*100,100)}%` }} />
                    </div>
                    <span className="w-12 text-right">{fmtN(prevQty)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Trend Chart ────────────────────────────────────────────────────── */}
      <section>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <SectionHeader title="Monthly Trend" />
            <div className="flex gap-1 -mt-3">
              {(['revenue','volume','size-mix'] as const).map(t => (
                <button key={t} onClick={() => setChartTab(t)}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${chartTab===t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {t === 'size-mix' ? 'Size Mix' : t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            {chartTab === 'revenue' ? (
              <ComposedChart data={monthly} margin={{ top:5,right:10,left:0,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month_label" tick={{ fontSize:10 }} />
                <YAxis tickFormatter={v => fmtL(v)} tick={{ fontSize:10 }} width={55} />
                <Tooltip formatter={(v, n) => [fmtCur(Number(v??0)), String(n)]} />
                <Legend wrapperStyle={{ fontSize:11 }} />
                <Bar dataKey="rev_4" name='4" Revenue' stackId="a" fill={SIZE_COLORS[4]} />
                <Bar dataKey="rev_6" name='6" Revenue' stackId="a" fill={SIZE_COLORS[6]} />
                <Bar dataKey="rev_8" name='8" Revenue' stackId="a" fill={SIZE_COLORS[8]} radius={[3,3,0,0]} />
                <Line dataKey="outstanding" name="Outstanding" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </ComposedChart>
            ) : chartTab === 'volume' ? (
              <ComposedChart data={monthly} margin={{ top:5,right:10,left:0,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month_label" tick={{ fontSize:10 }} />
                <YAxis tick={{ fontSize:10 }} width={55} tickFormatter={v => fmtN(v)} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize:11 }} />
                <Bar dataKey="qty_4" name='4"' stackId="a" fill={SIZE_COLORS[4]} />
                <Bar dataKey="qty_6" name='6"' stackId="a" fill={SIZE_COLORS[6]} />
                <Bar dataKey="qty_8" name='8"' stackId="a" fill={SIZE_COLORS[8]} radius={[3,3,0,0]} />
                <Line dataKey="orders" name="Orders" stroke="#64748b" strokeWidth={1.5} dot={{ r:2 }} yAxisId={0} />
              </ComposedChart>
            ) : (
              <BarChart data={monthly} margin={{ top:5,right:10,left:0,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month_label" tick={{ fontSize:10 }} />
                <YAxis tick={{ fontSize:10 }} tickFormatter={v => `${v}%`} domain={[0,100]} />
                <Tooltip formatter={(v) => [`${Number(v??0).toFixed(1)}%`]} />
                <Legend wrapperStyle={{ fontSize:11 }} />
                <Bar dataKey={(m: MonthRow) => m.total_qty > 0 ? Math.round((m.qty_4/m.total_qty)*100) : 0}
                  name='4"' stackId="p" fill={SIZE_COLORS[4]} />
                <Bar dataKey={(m: MonthRow) => m.total_qty > 0 ? Math.round((m.qty_6/m.total_qty)*100) : 0}
                  name='6"' stackId="p" fill={SIZE_COLORS[6]} />
                <Bar dataKey={(m: MonthRow) => m.total_qty > 0 ? Math.round((m.qty_8/m.total_qty)*100) : 0}
                  name='8"' stackId="p" fill={SIZE_COLORS[8]} radius={[3,3,0,0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Monthly Matrix Table ───────────────────────────────────────────── */}
      <section>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <SectionHeader title="Month × Size Matrix" sub="the full picture" />
            <div className="flex gap-1 -mt-3">
              {(['qty','revenue'] as const).map(v => (
                <button key={v} onClick={() => setTableView(v)}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${tableView===v ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {v === 'qty' ? '# Blocks' : '₹ Revenue'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-3 text-left font-semibold">Month</th>
                  {tableView === 'qty' ? <>
                    <th className="py-2 pr-2 text-right font-semibold" style={{ color: SIZE_COLORS[4] }}>4" Qty</th>
                    <th className="py-2 pr-2 text-right font-semibold text-slate-300">MoM</th>
                    <th className="py-2 pr-2 text-right font-semibold" style={{ color: SIZE_COLORS[6] }}>6" Qty</th>
                    <th className="py-2 pr-2 text-right font-semibold text-slate-300">MoM</th>
                    <th className="py-2 pr-2 text-right font-semibold" style={{ color: SIZE_COLORS[8] }}>8" Qty</th>
                    <th className="py-2 pr-2 text-right font-semibold text-slate-300">MoM</th>
                  </> : <>
                    <th className="py-2 pr-2 text-right font-semibold" style={{ color: SIZE_COLORS[4] }}>4" Rev</th>
                    <th className="py-2 pr-2 text-right font-semibold" style={{ color: SIZE_COLORS[6] }}>6" Rev</th>
                    <th className="py-2 pr-2 text-right font-semibold" style={{ color: SIZE_COLORS[8] }}>8" Rev</th>
                  </>}
                  <th className="py-2 pr-2 text-right font-semibold text-slate-700">Total</th>
                  <th className="py-2 pr-2 text-right font-semibold">Revenue</th>
                  <th className="py-2 pr-2 text-right font-semibold">MoM Rev</th>
                  <th className="py-2 pr-2 text-right font-semibold">Coll%</th>
                  <th className="py-2 text-right font-semibold">Orders</th>
                </tr>
              </thead>
              <tbody>
                {[...monthly].reverse().map((m, i, arr) => {
                  const isLatest = i === 0;
                  return (
                    <tr key={m.month_label} className={`border-b last:border-0 hover:bg-slate-50 ${isLatest ? 'bg-blue-50/50' : ''}`}>
                      <td className="py-2 pr-3 font-bold text-slate-700">
                        {m.month_label}
                        {isLatest && <span className="ml-1 text-[9px] bg-blue-500 text-white px-1 rounded">CURRENT</span>}
                      </td>
                      {tableView === 'qty' ? <>
                        <td className="py-2 pr-2 text-right font-semibold" style={{ color: SIZE_COLORS[4] }}>{fmtN(m.qty_4)}</td>
                        <td className="py-2 pr-2 text-right"><MoM val={m.mom_qty4} /></td>
                        <td className="py-2 pr-2 text-right font-semibold" style={{ color: SIZE_COLORS[6] }}>{fmtN(m.qty_6)}</td>
                        <td className="py-2 pr-2 text-right"><MoM val={m.mom_qty6} /></td>
                        <td className="py-2 pr-2 text-right font-semibold" style={{ color: SIZE_COLORS[8] }}>{fmtN(m.qty_8)}</td>
                        <td className="py-2 pr-2 text-right"><MoM val={m.mom_qty8} /></td>
                      </> : <>
                        <td className="py-2 pr-2 text-right" style={{ color: SIZE_COLORS[4] }}>{fmtL(m.rev_4)}</td>
                        <td className="py-2 pr-2 text-right" style={{ color: SIZE_COLORS[6] }}>{fmtL(m.rev_6)}</td>
                        <td className="py-2 pr-2 text-right" style={{ color: SIZE_COLORS[8] }}>{fmtL(m.rev_8)}</td>
                      </>}
                      <td className="py-2 pr-2 text-right font-bold text-slate-700">{fmtN(m.total_qty)}</td>
                      <td className="py-2 pr-2 text-right font-semibold text-blue-600">{fmtL(m.revenue)}</td>
                      <td className="py-2 pr-2 text-right"><MoM val={m.mom_revenue} /></td>
                      <td className="py-2 pr-2 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.collection_rate>=80 ? 'bg-emerald-100 text-emerald-700' : m.collection_rate>=50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                          {m.collection_rate}%
                        </span>
                      </td>
                      <td className="py-2 text-right text-slate-500">{m.orders}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-700">
                <tr>
                  <td className="py-2 pr-3">TOTAL</td>
                  {tableView === 'qty' ? <>
                    <td className="py-2 pr-2 text-right" style={{ color: SIZE_COLORS[4] }}>{fmtN(stats.total_qty_4)}</td>
                    <td className="py-2 pr-2" />
                    <td className="py-2 pr-2 text-right" style={{ color: SIZE_COLORS[6] }}>{fmtN(stats.total_qty_6)}</td>
                    <td className="py-2 pr-2" />
                    <td className="py-2 pr-2 text-right" style={{ color: SIZE_COLORS[8] }}>{fmtN(stats.total_qty_8)}</td>
                    <td className="py-2 pr-2" />
                  </> : <>
                    <td className="py-2 pr-2 text-right">{fmtL(sizes.find(s=>s.size===4)?.revenue??0)}</td>
                    <td className="py-2 pr-2 text-right">{fmtL(sizes.find(s=>s.size===6)?.revenue??0)}</td>
                    <td className="py-2 pr-2 text-right">{fmtL(sizes.find(s=>s.size===8)?.revenue??0)}</td>
                  </>}
                  <td className="py-2 pr-2 text-right">{fmtN(stats.total_volume)}</td>
                  <td className="py-2 pr-2 text-right text-blue-600">{fmtL(stats.total_revenue)}</td>
                  <td className="py-2 pr-2" />
                  <td className="py-2 pr-2 text-right text-slate-600">{collRate}%</td>
                  <td className="py-2 text-right">{stats.total_orders}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* ── Customer Analytics + Concentration ────────────────────────────── */}
      <section>
        <SectionHeader title="Customer Analytics" sub="Pareto · concentration · health" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Pareto concentration */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Revenue Concentration (Pareto)</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Top 3 customers</span>
                  <span className="font-bold text-slate-800">{concentration.top3_pct}% of revenue</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-3 rounded-full bg-violet-500" style={{ width:`${concentration.top3_pct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Top 5 customers</span>
                  <span className="font-bold text-slate-800">{concentration.top5_pct}% of revenue</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-3 rounded-full bg-blue-400" style={{ width:`${concentration.top5_pct}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {concentration.top5_pct > 70 ? '⚠ High concentration risk — over-reliance on few customers' :
                 concentration.top5_pct > 50 ? '○ Moderate concentration — diversify where possible' :
                 '✓ Healthy spread across customer base'}
              </p>
            </div>

            <div className="border-t border-slate-100 mt-3 pt-3 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">Customer Health</h4>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Active (ordered recently)</span><span className="font-semibold text-emerald-600">{customer_health.total - customer_health.at_risk - customer_health.inactive}</span></div>
              <div className="flex justify-between text-xs"><span className="text-amber-600">At Risk (31–60 days silent)</span><span className="font-semibold text-amber-600">{customer_health.at_risk}</span></div>
              <div className="flex justify-between text-xs"><span className="text-red-500">Inactive (60+ days silent)</span><span className="font-semibold text-red-500">{customer_health.inactive}</span></div>
            </div>
          </div>

          {/* Top customers horizontal */}
          <div className="md:col-span-2 bg-white rounded-xl shadow-sm p-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Top 10 Customers</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={top_customers.slice(0,10)} layout="vertical" margin={{ top:0,right:60,left:110,bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtL(v)} tick={{ fontSize:9 }} />
                <YAxis type="category" dataKey="customer_name" tick={{ fontSize:10 }} width={105} />
                <Tooltip formatter={(v, n) => [fmtCur(Number(v??0)), String(n)]} />
                <Legend wrapperStyle={{ fontSize:10 }} />
                <Bar dataKey="revenue" name="Revenue" radius={[0,2,2,0]}>
                  {top_customers.slice(0,10).map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
                <Bar dataKey="outstanding" name="Outstanding" fill="#fca5a5" radius={[0,2,2,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── Customer Detail Table ──────────────────────────────────────────── */}
      <section>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <SectionHeader title="Customer Ledger Summary" sub="size-wise breakdown" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-400 font-semibold">
                  <th className="py-2 pr-2 text-left">#</th>
                  <th className="py-2 pr-2 text-left">Customer</th>
                  <th className="py-2 pr-2 text-right">Revenue</th>
                  <th className="py-2 pr-2 text-right" style={{ color: SIZE_COLORS[4] }}>4"</th>
                  <th className="py-2 pr-2 text-right" style={{ color: SIZE_COLORS[6] }}>6"</th>
                  <th className="py-2 pr-2 text-right" style={{ color: SIZE_COLORS[8] }}>8"</th>
                  <th className="py-2 pr-2 text-right">Total Qty</th>
                  <th className="py-2 pr-2 text-right">Avg Rate</th>
                  <th className="py-2 pr-2 text-right">Outstanding</th>
                  <th className="py-2 pr-2 text-right">Coll%</th>
                  <th className="py-2 pr-2 text-right">Orders</th>
                  <th className="py-2 pr-2 text-right">Months</th>
                  <th className="py-2 text-right">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {top_customers.map((c, i) => {
                  const coll = c.revenue > 0 ? Math.round(((c.revenue-c.outstanding)/c.revenue)*100) : 100;
                  const avgRate = c.volume > 0 ? Math.round(c.revenue/c.volume) : 0;
                  const daysSince = c.last_delivery
                    ? Math.round((Date.now() - new Date(c.last_delivery).getTime()) / 86400000)
                    : 999;
                  const statusColor = daysSince > 60 ? 'text-red-400' : daysSince > 30 ? 'text-amber-500' : 'text-emerald-500';
                  return (
                    <tr key={c.customer_name} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-1.5 pr-2 text-slate-400">{i+1}</td>
                      <td className="py-1.5 pr-2 font-semibold text-slate-800 max-w-28 truncate">{c.customer_name}</td>
                      <td className="py-1.5 pr-2 text-right font-bold text-blue-600">{fmtL(c.revenue)}</td>
                      <td className="py-1.5 pr-2 text-right" style={{ color: SIZE_COLORS[4] }}>{fmtN(c.qty_4 ?? 0)}</td>
                      <td className="py-1.5 pr-2 text-right" style={{ color: SIZE_COLORS[6] }}>{fmtN(c.qty_6 ?? 0)}</td>
                      <td className="py-1.5 pr-2 text-right" style={{ color: SIZE_COLORS[8] }}>{fmtN(c.qty_8 ?? 0)}</td>
                      <td className="py-1.5 pr-2 text-right font-medium text-slate-600">{fmtN(c.volume)}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-500">₹{avgRate.toLocaleString('en-IN')}</td>
                      <td className={`py-1.5 pr-2 text-right font-medium ${c.outstanding>0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {c.outstanding > 0 ? fmtL(c.outstanding) : '✓'}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${coll>=80 ? 'bg-emerald-100 text-emerald-700' : coll>=50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                          {coll}%
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right text-slate-500">{c.orders}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-400">{c.active_months}</td>
                      <td className={`py-1.5 text-right text-[10px] font-medium ${statusColor}`}>
                        {c.last_delivery ? c.last_delivery.split('-').reverse().join('/') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Collection + Ageing ───────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Collections & Receivables" sub="DSO · ageing · at-risk amount" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ageing */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Outstanding Ageing</h4>
            {ageingTotal > 0 ? (
              <>
                <div className="space-y-3 mb-3">
                  {[
                    { label:'0–15 days', val:ageing?.d0_15??0, color:'bg-emerald-400', risk:'Current' },
                    { label:'16–30 days', val:ageing?.d16_30??0, color:'bg-blue-400', risk:'Normal' },
                    { label:'31–60 days', val:ageing?.d31_60??0, color:'bg-amber-400', risk:'Watch' },
                    { label:'61–90 days', val:ageing?.d61_90??0, color:'bg-orange-500', risk:'Overdue' },
                    { label:'90+ days', val:ageing?.d90plus??0, color:'bg-red-500', risk:'Critical' },
                  ].map(b => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-20 flex-shrink-0">{b.label}</span>
                      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-4 rounded-full ${b.color}`} style={{ width:`${ageingTotal>0 ? Math.max((b.val/ageingTotal)*100, b.val>0?2:0) : 0}%` }} />
                      </div>
                      <span className={`text-[10px] font-semibold w-14 text-right ${b.risk==='Critical'?'text-red-600':b.risk==='Overdue'?'text-orange-600':'text-slate-600'}`}>{fmtL(b.val)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Total Receivable · {ageing?.customers_with_due ?? 0} customers</span>
                  <span className="font-bold text-rose-600">{fmtCur(ageingTotal)}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-28 text-emerald-600 font-semibold text-sm">
                ✓ All accounts settled
              </div>
            )}
          </div>

          {/* DSO + Collection metrics */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Receivables Health Metrics</h4>
            <div className="space-y-3">
              {[
                { label:'Days Sales Outstanding (DSO)', val:`${Math.min(dso?.dso_estimate??0,365)} days`, note: dso?.dso_estimate>60 ? '⚠ Above industry norm (≤30 ideal)' : '✓ Within healthy range', alert: (dso?.dso_estimate??0)>60 },
                { label:'Overall Collection Rate', val:`${collRate}%`, note: collRate>=80 ? '✓ Good' : collRate>=60 ? '○ Needs improvement' : '⚠ Critical — follow up urgently', alert: collRate<60 },
                { label:'At-Risk Customers (30–60 days)', val:`${customer_health.at_risk} customers`, note:'No recent orders — needs follow-up', alert: customer_health.at_risk>3 },
                { label:'Inactive Customers (60+ days)', val:`${customer_health.inactive} customers`, note:'Potential churn — re-engage immediately', alert: customer_health.inactive>2 },
                { label:'Overdue (61+ days) Amount', val:fmtL((ageing?.d61_90??0)+(ageing?.d90plus??0)), note:'Escalate for urgent collection', alert: ((ageing?.d61_90??0)+(ageing?.d90plus??0)) > 100000 },
              ].map(m => (
                <div key={m.label} className={`flex items-start justify-between p-2 rounded-lg ${m.alert ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <div>
                    <p className="text-xs font-medium text-slate-700">{m.label}</p>
                    <p className={`text-[10px] mt-0.5 ${m.alert ? 'text-red-500' : 'text-slate-400'}`}>{m.note}</p>
                  </div>
                  <span className={`text-sm font-bold ml-4 flex-shrink-0 ${m.alert ? 'text-red-600' : 'text-slate-700'}`}>{m.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI Insights ───────────────────────────────────────────────────── */}
      <AIInsights reportData={data} module="blocks" unitLabel="blocks" />
    </div>
  );
}
