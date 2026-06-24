'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area,
} from 'recharts';
import AIInsights from './AIInsights';

interface MonthRow {
  month_label: string;
  first_date: string;
  volume: number;
  revenue: number;
  outstanding: number;
  collected: number;
  collection_rate: number;
  orders: number;
  customers: number;
}

interface SizeRow {
  size: number;
  volume: number;
  revenue: number;
  orders: number;
  avg_rate: number;
}

interface CustomerRow {
  customer_name: string;
  volume: number;
  revenue: number;
  outstanding: number;
  orders: number;
  last_delivery: string;
}

interface AgeingRow {
  d0_15: number; d16_30: number; d31_60: number; d61_90: number; d90plus: number;
}

interface Stats {
  total_volume: number; total_revenue: number; total_outstanding: number;
  total_orders: number; total_customers: number; first_date: string; last_date: string;
}

interface ReportData {
  stats: Stats;
  monthly: MonthRow[];
  sizes: SizeRow[];
  top_customers: CustomerRow[];
  ageing: AgeingRow;
}

function fmtL(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}
function fmtCur(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

const SIZE_COLORS: Record<number, string> = { 4: '#3b82f6', 6: '#8b5cf6', 8: '#f59e0b' };
const CHART_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16'];

function KPICard({ label, value, sub, color, icon }: { label:string; value:string; sub?:string; color:string; icon:React.ReactNode }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1 leading-tight">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className="text-slate-300 mt-1">{icon}</div>
      </div>
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: {value:number;name:string}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-slate-600">{p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmtL(p.value) : p.value}</p>
      ))}
    </div>
  );
}

export default function BlocksReport() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState({ from: '', to: '' });
  const [activeTab, setActiveTab] = useState<'revenue' | 'volume' | 'collection'>('revenue');
  const [chartView, setChartView] = useState<'bar' | 'line'>('bar');

  const fetchReport = (from: string, to: string) => {
    setLoading(true);
    const params = from && to ? `?from=${from}&to=${to}` : '';
    fetch(`/api/report${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchReport('', ''); }, []);

  const monthlyGrowth = useMemo(() => {
    if (!data?.monthly || data.monthly.length < 2) return null;
    const last = data.monthly[data.monthly.length - 1];
    const prev = data.monthly[data.monthly.length - 2];
    return prev.revenue > 0 ? Math.round(((last.revenue - prev.revenue) / prev.revenue) * 100) : 0;
  }, [data]);

  const ageingTotal = useMemo(() => {
    if (!data?.ageing) return 0;
    return (data.ageing.d0_15||0)+(data.ageing.d16_30||0)+(data.ageing.d31_60||0)+(data.ageing.d61_90||0)+(data.ageing.d90plus||0);
  }, [data]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Month','Volume (blocks)','Revenue (₹)','Collected (₹)','Outstanding (₹)','Collection%','Orders'],
      ...data.monthly.map(m => [m.month_label,m.volume,m.revenue,m.collected,m.outstanding,m.collection_rate+'%',m.orders]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'blocks-monthly-report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0,1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}</div>
      <div className="h-64 bg-gray-100 rounded-xl" /><div className="h-52 bg-gray-100 rounded-xl" />
    </div>
  );
  if (!data) return <div className="p-8 text-center text-slate-400">Failed to load report data.</div>;

  const { stats, monthly, sizes, top_customers, ageing } = data;
  const collRate = stats.total_revenue > 0 ? Math.round(((stats.total_revenue - stats.total_outstanding) / stats.total_revenue) * 100) : 0;

  return (
    <div className="space-y-5 max-w-6xl mx-auto p-3">

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setApplied(dateRange); fetchReport(dateRange.from, dateRange.to); }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium cursor-pointer">Apply</button>
          {(applied.from || applied.to) && (
            <button onClick={() => { setDateRange({ from:'', to:'' }); setApplied({ from:'', to:'' }); fetchReport('',''); }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">Clear</button>
          )}
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 cursor-pointer font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Revenue" value={fmtL(stats.total_revenue)} sub={`${stats.total_orders} orders`} color="border-l-blue-500"
          icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <KPICard label="Total Volume" value={`${(stats.total_volume || 0).toLocaleString('en-IN')} blocks`} sub={`${stats.total_customers} customers`} color="border-l-violet-500"
          icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.5}/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.5}/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.5}/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={1.5}/></svg>} />
        <KPICard label="Outstanding" value={fmtL(stats.total_outstanding)} sub={`${collRate}% collected`} color="border-l-rose-500"
          icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
        <KPICard label="Avg Rate/Block" value={stats.total_volume > 0 ? fmtCur(Math.round(stats.total_revenue / stats.total_volume)) : '—'}
          sub={monthlyGrowth !== null ? `${monthlyGrowth >= 0 ? '+' : ''}${monthlyGrowth}% vs last month` : undefined} color="border-l-emerald-500"
          icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
      </div>

      {/* Main chart */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Monthly Trend</h3>
          <div className="flex gap-1">
            {(['revenue','volume','collection'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${activeTab===t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
            <div className="w-px bg-slate-200 mx-1" />
            {(['bar','line'] as const).map(v => (
              <button key={v} onClick={() => setChartView(v)}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${chartView===v ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {v==='bar' ? '▐▌' : '∿'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          {activeTab === 'revenue' ? (
            chartView === 'bar' ? (
              <ComposedChart data={monthly} margin={{ top:5,right:10,left:0,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month_label" tick={{ fontSize:10 }} />
                <YAxis tickFormatter={v => fmtL(v)} tick={{ fontSize:10 }} width={55} />
                <Tooltip content={<RevenueTooltip />} />
                <Legend wrapperStyle={{ fontSize:11 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[3,3,0,0]} />
                <Line dataKey="outstanding" name="Outstanding" stroke="#ef4444" strokeWidth={2} dot={false} />
              </ComposedChart>
            ) : (
              <LineChart data={monthly} margin={{ top:5,right:10,left:0,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month_label" tick={{ fontSize:10 }} />
                <YAxis tickFormatter={v => fmtL(v)} tick={{ fontSize:10 }} width={55} />
                <Tooltip content={<RevenueTooltip />} />
                <Legend wrapperStyle={{ fontSize:11 }} />
                <Line dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2.5} dot={{ r:3 }} />
                <Line dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2} dot={{ r:3 }} />
                <Line dataKey="outstanding" name="Outstanding" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </LineChart>
            )
          ) : activeTab === 'volume' ? (
            <BarChart data={monthly} margin={{ top:5,right:10,left:0,bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month_label" tick={{ fontSize:10 }} />
              <YAxis tick={{ fontSize:10 }} width={55} />
              <Tooltip content={<RevenueTooltip />} />
              <Legend wrapperStyle={{ fontSize:11 }} />
              <Bar dataKey="volume" name="Blocks" fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="orders" name="Orders" fill="#e0e7ff" radius={[3,3,0,0]} />
            </BarChart>
          ) : (
            <ComposedChart data={monthly} margin={{ top:5,right:10,left:0,bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month_label" tick={{ fontSize:10 }} />
              <YAxis yAxisId="left" tickFormatter={v => fmtL(v)} tick={{ fontSize:10 }} width={55} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize:10 }} width={40} />
              <Tooltip content={<RevenueTooltip />} />
              <Legend wrapperStyle={{ fontSize:11 }} />
              <Area yAxisId="left" dataKey="collected" name="Collected" fill="#d1fae5" stroke="#10b981" strokeWidth={2} />
              <Bar yAxisId="left" dataKey="outstanding" name="Outstanding" fill="#fecaca" stroke="#ef4444" radius={[3,3,0,0]} />
              <Line yAxisId="right" dataKey="collection_rate" name="Collection %" stroke="#3b82f6" strokeWidth={2} dot={{ r:3 }} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Size mix + Ageing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Block Size Mix</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={sizes} dataKey="volume" nameKey="size" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {sizes.map((s, i) => <Cell key={s.size} fill={SIZE_COLORS[s.size] ?? CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${Number(v ?? 0).toLocaleString('en-IN')} blocks`, 'Volume']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {sizes.map((s, i) => {
                const total = sizes.reduce((sum, r) => sum + r.volume, 0);
                const pct = total > 0 ? Math.round((s.volume / total) * 100) : 0;
                const color = SIZE_COLORS[s.size] ?? CHART_COLORS[i % CHART_COLORS.length];
                return (
                  <div key={s.size}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs font-medium text-slate-700">{s.size}" Block</span>
                      <span className="ml-auto text-xs text-slate-400">{pct}% · ₹{s.avg_rate}/pc</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div className="h-1.5 rounded-full" style={{ width:`${pct}%`, background:color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Outstanding Ageing</h3>
          {ageingTotal > 0 ? (
            <>
              <div className="space-y-3">
                {[
                  { label:'0–15 days', val:ageing?.d0_15??0, color:'bg-emerald-400' },
                  { label:'16–30 days', val:ageing?.d16_30??0, color:'bg-blue-400' },
                  { label:'31–60 days', val:ageing?.d31_60??0, color:'bg-amber-400' },
                  { label:'61–90 days', val:ageing?.d61_90??0, color:'bg-orange-500' },
                  { label:'90+ days', val:ageing?.d90plus??0, color:'bg-red-500' },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0">{b.label}</span>
                    <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-4 rounded-full ${b.color}`} style={{ width:`${ageingTotal>0 ? Math.max((b.val/ageingTotal)*100, b.val>0?2:0) : 0}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-20 text-right">{fmtL(b.val)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs">
                <span className="text-slate-500">Total Outstanding</span>
                <span className="font-bold text-rose-600">{fmtCur(ageingTotal)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-emerald-600 font-medium">All outstanding cleared</div>
          )}
        </div>
      </div>

      {/* Top Customers bar */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Customers by Revenue</h3>
        <ResponsiveContainer width="100%" height={Math.max(200, top_customers.length * 28)}>
          <BarChart data={top_customers} layout="vertical" margin={{ top:0,right:80,left:120,bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tickFormatter={v => fmtL(v)} tick={{ fontSize:10 }} />
            <YAxis type="category" dataKey="customer_name" tick={{ fontSize:11 }} width={115} />
            <Tooltip formatter={(v, name) => [fmtCur(Number(v ?? 0)), String(name)]} />
            <Legend wrapperStyle={{ fontSize:11 }} />
            <Bar dataKey="revenue" name="Revenue" radius={[0,3,3,0]}>
              {top_customers.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
            <Bar dataKey="outstanding" name="Outstanding" fill="#fca5a5" radius={[0,3,3,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Customer table */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Customer Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-slate-500 text-left">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium text-right">Revenue</th>
                <th className="py-2 pr-3 font-medium text-right">Volume</th>
                <th className="py-2 pr-3 font-medium text-right">Avg Rate</th>
                <th className="py-2 pr-3 font-medium text-right">Outstanding</th>
                <th className="py-2 pr-3 font-medium text-right">Coll%</th>
                <th className="py-2 pr-3 font-medium text-right">Orders</th>
                <th className="py-2 font-medium text-right">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {top_customers.map((c, i) => {
                const collPct = c.revenue > 0 ? Math.round(((c.revenue - c.outstanding) / c.revenue) * 100) : 100;
                const avgRate = c.volume > 0 ? Math.round(c.revenue / c.volume) : 0;
                return (
                  <tr key={c.customer_name} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-3 text-slate-400">{i+1}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{c.customer_name}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-blue-600">{fmtL(c.revenue)}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{(c.volume||0).toLocaleString('en-IN')}</td>
                    <td className="py-2 pr-3 text-right text-slate-500">₹{avgRate.toLocaleString('en-IN')}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${c.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {c.outstanding > 0 ? fmtL(c.outstanding) : '✓ Clear'}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${collPct>=90 ? 'bg-emerald-100 text-emerald-700' : collPct>=60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {collPct}%
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-500">{c.orders}</td>
                    <td className="py-2 text-right text-slate-400">{c.last_delivery ? c.last_delivery.split('-').reverse().join('/') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Monthly Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-slate-500 text-left">
                <th className="py-2 pr-3 font-medium">Month</th>
                <th className="py-2 pr-3 font-medium text-right">Blocks</th>
                <th className="py-2 pr-3 font-medium text-right">Revenue</th>
                <th className="py-2 pr-3 font-medium text-right">Collected</th>
                <th className="py-2 pr-3 font-medium text-right">Outstanding</th>
                <th className="py-2 pr-3 font-medium text-right">Coll%</th>
                <th className="py-2 pr-3 font-medium text-right">Orders</th>
                <th className="py-2 font-medium text-right">Customers</th>
              </tr>
            </thead>
            <tbody>
              {[...monthly].reverse().map((m, i, arr) => {
                const prev = arr[i+1];
                const revGrowth = prev?.revenue > 0 ? Math.round(((m.revenue - prev.revenue)/prev.revenue)*100) : null;
                return (
                  <tr key={m.month_label} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-3 font-semibold text-slate-700">{m.month_label}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{(m.volume||0).toLocaleString('en-IN')}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-blue-600">{fmtL(m.revenue)}</td>
                    <td className="py-2 pr-3 text-right text-emerald-600">{fmtL(m.collected)}</td>
                    <td className={`py-2 pr-3 text-right ${m.outstanding>0 ? 'text-rose-500' : 'text-slate-400'}`}>{m.outstanding>0 ? fmtL(m.outstanding) : '—'}</td>
                    <td className="py-2 pr-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-1.5 bg-blue-400 rounded-full" style={{ width:`${m.collection_rate}%` }} />
                        </div>
                        <span className="text-slate-500">{m.collection_rate}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-500">{m.orders}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-slate-500">{m.customers}</span>
                        {revGrowth !== null && (
                          <span className={`text-[10px] font-medium ${revGrowth>=0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {revGrowth>=0 ? '▲' : '▼'}{Math.abs(revGrowth)}%
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr className="font-bold text-slate-700">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pr-3 text-right">{(stats.total_volume||0).toLocaleString('en-IN')}</td>
                <td className="py-2 pr-3 text-right text-blue-600">{fmtL(stats.total_revenue)}</td>
                <td className="py-2 pr-3 text-right text-emerald-600">{fmtL(stats.total_revenue - stats.total_outstanding)}</td>
                <td className="py-2 pr-3 text-right text-rose-500">{fmtL(stats.total_outstanding)}</td>
                <td className="py-2 pr-3 text-right text-slate-600">{collRate}%</td>
                <td className="py-2 pr-3 text-right">{stats.total_orders}</td>
                <td className="py-2 text-right">{stats.total_customers}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* AI Insights */}
      <AIInsights reportData={data} module="blocks" unitLabel="blocks" />
    </div>
  );
}
