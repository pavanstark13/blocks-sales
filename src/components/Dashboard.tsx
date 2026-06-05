'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

interface Summary {
  monthSummary: MonthRow[];
  outstanding: SaleRow[];
  topCustomers: CustomerRow[];
  paymentBreakdown: PaymentRow[];
  sizeSummary: SizeRow[];
  totals: TotalsRow;
}

interface MonthRow {
  month_label: string;
  orders: number;
  total_qty: number;
  qty_4: number;
  qty_6: number;
  qty_8: number;
  total_amount: number;
  total_advance: number;
  total_balance: number;
  open_orders: number;
  pending_orders: number;
  closed_orders: number;
}

interface SaleRow {
  id: number;
  date: string;
  customer_name: string;
  size: number;
  quantity: number;
  amount: number;
  balance: number;
  status: string;
  month_label: string;
}

interface CustomerRow {
  customer_name: string;
  orders: number;
  total_qty: number;
  total_amount: number;
  outstanding: number;
}

interface PaymentRow {
  mode: string;
  orders: number;
  total: number;
}

interface SizeRow {
  size: number;
  orders: number;
  total_qty: number;
  avg_rate: number;
  total_amount: number;
}

interface TotalsRow {
  total_orders: number;
  total_blocks: number;
  total_revenue: number;
  total_outstanding: number;
  unique_customers: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function fmt(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

function fmtCur(n: number | null) {
  if (n == null) return '—';
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/summary').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading dashboard...</div>;
  if (!data) return null;

  const { totals, monthSummary, topCustomers, paymentBreakdown, sizeSummary, outstanding } = data;

  const recentMonths = monthSummary.slice(-6);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Orders', value: fmt(totals.total_orders), color: 'text-blue-600' },
          { label: 'Total Blocks Sold', value: fmt(totals.total_blocks), color: 'text-emerald-600' },
          { label: 'Total Revenue', value: fmtCur(totals.total_revenue), color: 'text-violet-600' },
          { label: 'Outstanding Balance', value: fmtCur(totals.total_outstanding), color: 'text-rose-600' },
          { label: 'Unique Customers', value: fmt(totals.unique_customers), color: 'text-amber-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-medium">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly revenue chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Monthly Revenue (Last 6 Months)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={recentMonths} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month_label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmtCur(Number(v))} />
            <Legend />
            <Bar dataKey="total_amount" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="total_balance" name="Outstanding" fill="#fbbf24" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Block volume by month */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Block Volume by Size (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={recentMonths}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month_label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="qty_4" name="4&quot; Blocks" fill="#3b82f6" stackId="a" />
              <Bar dataKey="qty_6" name="6&quot; Blocks" fill="#10b981" stackId="a" />
              <Bar dataKey="qty_8" name="8&quot; Blocks" fill="#f59e0b" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment mode breakdown */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Payment Mode Breakdown</h2>
          <div className="flex items-center">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={paymentBreakdown} dataKey="total" nameKey="mode" cx="50%" cy="50%" outerRadius={80}>
                  {paymentBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtCur(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {paymentBreakdown.map((p, i) => (
                <div key={p.mode} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-600 flex-1 truncate">{p.mode}</span>
                  <span className="font-medium">{fmtCur(p.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Size summary */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Block Size Summary (All Time)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="pb-2">Size</th>
                <th className="pb-2 text-right">Qty Sold</th>
                <th className="pb-2 text-right">Avg Rate</th>
                <th className="pb-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sizeSummary.map(s => (
                <tr key={s.size} className="border-b border-slate-50">
                  <td className="py-2 font-medium">{s.size}&quot;</td>
                  <td className="py-2 text-right">{fmt(s.total_qty)}</td>
                  <td className="py-2 text-right">{s.avg_rate ? `₹${s.avg_rate}` : '—'}</td>
                  <td className="py-2 text-right font-medium text-blue-600">{fmtCur(s.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top customers */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Top 10 Customers by Revenue</h2>
          <div className="space-y-2 overflow-y-auto max-h-52">
            {topCustomers.slice(0, 10).map((c, i) => (
              <div key={c.customer_name} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.customer_name}</p>
                  <p className="text-xs text-slate-400">{fmt(c.total_qty)} blocks · {c.orders} orders</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-blue-600">{fmtCur(c.total_amount)}</p>
                  {c.outstanding > 0 && <p className="text-xs text-rose-500">{fmtCur(c.outstanding)} due</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly summary table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Monthly Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="pb-2 pr-4">Month</th>
                <th className="pb-2 text-right pr-4">Orders</th>
                <th className="pb-2 text-right pr-4">Total Blocks</th>
                <th className="pb-2 text-right pr-4">4&quot;</th>
                <th className="pb-2 text-right pr-4">6&quot;</th>
                <th className="pb-2 text-right pr-4">8&quot;</th>
                <th className="pb-2 text-right pr-4">Revenue</th>
                <th className="pb-2 text-right pr-4">Outstanding</th>
                <th className="pb-2 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {monthSummary.map(m => (
                <tr key={m.month_label} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 pr-4 font-medium">{m.month_label}</td>
                  <td className="py-2 text-right pr-4">{m.orders}</td>
                  <td className="py-2 text-right pr-4">{fmt(m.total_qty)}</td>
                  <td className="py-2 text-right pr-4 text-blue-600">{fmt(m.qty_4)}</td>
                  <td className="py-2 text-right pr-4 text-emerald-600">{fmt(m.qty_6)}</td>
                  <td className="py-2 text-right pr-4 text-amber-600">{fmt(m.qty_8)}</td>
                  <td className="py-2 text-right pr-4 font-semibold">{fmtCur(m.total_amount)}</td>
                  <td className={`py-2 text-right pr-4 ${m.total_balance > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {fmtCur(m.total_balance)}
                  </td>
                  <td className="py-2 text-right">
                    {m.open_orders > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                        {m.open_orders}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent outstanding */}
      {outstanding.length > 0 && (
        <div className="bg-white rounded-xl border border-rose-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-rose-700 mb-4">
            Outstanding Orders ({outstanding.length} open/pending)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3 text-right">Size</th>
                  <th className="pb-2 pr-3 text-right">Qty</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3 text-right">Balance</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.slice(0, 15).map(s => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="py-1.5 pr-3 text-slate-500">{s.date}</td>
                    <td className="py-1.5 pr-3 font-medium">{s.customer_name || '—'}</td>
                    <td className="py-1.5 pr-3 text-right">{s.size}&quot;</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(s.quantity)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmtCur(s.amount)}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold text-rose-600">{fmtCur(s.balance)}</td>
                    <td className="py-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>{s.status}</span>
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
