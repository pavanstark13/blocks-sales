'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  today_volume: number;
  month_volume: number;
  month_amount: number;
  outstanding_amount: number;
  outstanding_count: number;
  grade_breakdown: { M10: number; M15: number; M20: number; M25: number; M30: number };
  monthly_summary: Array<{ month_label: string; volume: number; amount: number; orders: number }>;
}

function fmtCur(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const GRADE_COLORS: Record<string, string> = {
  M10: 'bg-slate-400',
  M15: 'bg-cyan-400',
  M20: 'bg-blue-500',
  M25: 'bg-violet-500',
  M30: 'bg-purple-600',
};

const GRADE_TEXT: Record<string, string> = {
  M10: 'text-slate-600',
  M15: 'text-cyan-600',
  M20: 'text-blue-600',
  M25: 'text-violet-600',
  M30: 'text-purple-700',
};

export default function RMCDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rmc/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading dashboard...</div>;
  }
  if (!data) {
    return <div className="text-center py-12 text-red-500">Failed to load dashboard.</div>;
  }

  const grades = ['M10', 'M15', 'M20', 'M25', 'M30'] as const;
  const totalGradeVolume = grades.reduce((s, g) => s + (data.grade_breakdown[g] || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Today&apos;s Volume</p>
          <p className="text-3xl font-bold text-purple-600">{data.today_volume.toFixed(1)}</p>
          <p className="text-xs text-slate-400 mt-1">m³ delivered today</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">This Month Volume</p>
          <p className="text-3xl font-bold text-purple-600">{data.month_volume.toFixed(1)}</p>
          <p className="text-xs text-slate-400 mt-1">m³ this month</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">This Month Amount</p>
          <p className="text-3xl font-bold text-slate-800">{fmtCur(data.month_amount)}</p>
          <p className="text-xs text-slate-400 mt-1">revenue this month</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Outstanding</p>
          <p className="text-3xl font-bold text-rose-600">{fmtCur(data.outstanding_amount)}</p>
          <p className="text-xs text-slate-400 mt-1">{data.outstanding_count} open order{data.outstanding_count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Grade Breakdown */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Grade Breakdown (All Time)</h2>
        <div className="space-y-3">
          {grades.map(g => {
            const vol = data.grade_breakdown[g] || 0;
            const pct = totalGradeVolume > 0 ? (vol / totalGradeVolume) * 100 : 0;
            return (
              <div key={g} className="flex items-center gap-3">
                <span className={`text-xs font-bold w-8 ${GRADE_TEXT[g]}`}>{g}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${GRADE_COLORS[g]} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600 w-16 text-right">
                  {vol.toFixed(1)} m³
                </span>
                <span className="text-xs text-slate-400 w-10 text-right">
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Total: <span className="font-semibold text-slate-600">{totalGradeVolume.toFixed(1)} m³</span>
        </p>
      </div>

      {/* Monthly Volume Chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Monthly Summary (Last 6 Months)</h2>
        {data.monthly_summary.length === 0 ? (
          <p className="text-slate-400 text-sm">No data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 font-semibold border-b border-slate-100">
                  <th className="pb-2 pr-4">Month</th>
                  <th className="pb-2 pr-4 text-right">Volume (m³)</th>
                  <th className="pb-2 pr-4 text-right">Amount</th>
                  <th className="pb-2 text-right">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.monthly_summary.map(m => (
                  <tr key={m.month_label} className="hover:bg-slate-50">
                    <td className="py-2 pr-4 font-medium text-slate-700">{m.month_label}</td>
                    <td className="py-2 pr-4 text-right">
                      <span className="font-semibold text-purple-600">{(m.volume || 0).toFixed(1)}</span>
                    </td>
                    <td className="py-2 pr-4 text-right text-slate-700">{fmtCur(m.amount || 0)}</td>
                    <td className="py-2 text-right text-slate-500">{m.orders}</td>
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
