'use client';

import { useState, useEffect, useCallback } from 'react';

interface Sale {
  id: number;
  date: string;
  customer_name: string | null;
  site_address?: string | null;
  grade?: string;
  amount: number | null;
  balance: number | null;
  status: string;
}

interface AgeBucket {
  label: string;
  min: number;
  max: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

const BUCKETS: AgeBucket[] = [
  { label: '0–15 days',  min: 0,  max: 15,  color: 'text-emerald-700', bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-200' },
  { label: '16–30 days', min: 16, max: 30,  color: 'text-yellow-700',  bgColor: 'bg-yellow-50',   borderColor: 'border-yellow-200' },
  { label: '31–60 days', min: 31, max: 60,  color: 'text-orange-700',  bgColor: 'bg-orange-50',   borderColor: 'border-orange-200' },
  { label: '61–90 days', min: 61, max: 90,  color: 'text-red-700',     bgColor: 'bg-red-50',      borderColor: 'border-red-200' },
  { label: '90+ days',   min: 91, max: Infinity, color: 'text-red-900', bgColor: 'bg-red-100',    borderColor: 'border-red-300' },
];

function daysBetween(dateStr: string): number {
  const sale = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  sale.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - sale.getTime()) / (1000 * 60 * 60 * 24));
}

function getBucket(days: number): AgeBucket {
  return BUCKETS.find(b => days >= b.min && days <= b.max) ?? BUCKETS[BUCKETS.length - 1];
}

function fmtCur(n: number | null | undefined) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

interface Props {
  apiBase: '/api' | '/api/rmc';
}

type SortKey = 'days' | 'customer_name' | 'balance' | 'date';

export default function AgeingReport({ apiBase }: Props) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const isRmc = apiBase === '/api/rmc';

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const [openRes, pendingRes] = await Promise.all([
        fetch(`${apiBase}/sales?status=OPEN&limit=500`),
        fetch(`${apiBase}/sales?status=PENDING&limit=500`),
      ]);
      const openData = await openRes.json();
      const pendingData = await pendingRes.json();
      const combined: Sale[] = [
        ...(openData.data ?? []),
        ...(pendingData.data ?? []),
      ];
      setSales(combined);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const withDays = sales
    .filter(s => s.balance != null && Number(s.balance) > 0)
    .map(s => ({ ...s, days: daysBetween(s.date) }));

  const sorted = [...withDays].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'days') cmp = a.days - b.days;
    else if (sortKey === 'customer_name') cmp = (a.customer_name || '').localeCompare(b.customer_name || '');
    else if (sortKey === 'balance') cmp = (Number(a.balance) || 0) - (Number(b.balance) || 0);
    else if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  function setortDir(fn: (d: 'asc' | 'desc') => 'asc' | 'desc') {
    setSortDir(prev => fn(prev));
  }

  const bucketStats = BUCKETS.map(b => {
    const items = withDays.filter(s => s.days >= b.min && s.days <= b.max);
    return {
      ...b,
      count: items.length,
      totalBalance: items.reduce((sum, s) => sum + Number(s.balance || 0), 0),
    };
  });

  const totalBalance = withDays.reduce((s, x) => s + Number(x.balance || 0), 0);

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-slate-400">
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  if (loading) return <div className="text-center py-12 text-slate-400">Loading outstanding sales...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Outstanding Ageing Report</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {withDays.length} open/pending bills · Total outstanding: <span className="font-semibold text-rose-600">{fmtCur(totalBalance)}</span>
            </p>
          </div>
        </div>

        {/* Bucket Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {bucketStats.map(b => (
            <div key={b.label} className={`rounded-xl border p-3 ${b.bgColor} ${b.borderColor}`}>
              <p className={`text-xs font-semibold ${b.color}`}>{b.label}</p>
              <p className={`text-xl font-bold mt-1 ${b.color}`}>{b.count}</p>
              <p className={`text-xs mt-0.5 ${b.color} opacity-80`}>{fmtCur(b.totalBalance)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-500 font-semibold">
                <th className="px-3 py-2 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('customer_name')}>
                  Customer <SortIcon col="customer_name" />
                </th>
                {isRmc && <th className="px-3 py-2">Site</th>}
                {isRmc && <th className="px-3 py-2">Grade</th>}
                <th className="px-3 py-2 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('date')}>
                  Date <SortIcon col="date" />
                </th>
                <th className="px-3 py-2 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('days')}>
                  Days <SortIcon col="days" />
                </th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right cursor-pointer hover:text-slate-700" onClick={() => toggleSort('balance')}>
                  Balance <SortIcon col="balance" />
                </th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={isRmc ? 8 : 6} className="text-center py-8 text-slate-400">
                    No outstanding balances found
                  </td>
                </tr>
              ) : sorted.map(s => {
                const b = getBucket(s.days);
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700 max-w-40 truncate">{s.customer_name || '—'}</td>
                    {isRmc && <td className="px-3 py-2 text-xs text-slate-500 max-w-32 truncate">{s.site_address || '—'}</td>}
                    {isRmc && (
                      <td className="px-3 py-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{s.grade}</span>
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{s.date}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.bgColor} ${b.color} border ${b.borderColor}`}>
                        {s.days}d
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtCur(s.amount)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-rose-600">{fmtCur(s.balance)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>{s.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
