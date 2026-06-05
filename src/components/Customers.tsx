'use client';

import { useEffect, useState, useCallback } from 'react';

interface Customer {
  customer_name: string;
  address: string;
  phone: string;
  total_orders: number;
  total_qty: number;
  total_amount: number;
  outstanding: number;
  last_order: string;
}

function fmtCur(n: number | null) {
  if (n == null) return '—';
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

function fmt(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<unknown[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)   params.set('q', search);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const res = await fetch('/api/customers?' + params);
    const data = await res.json();
    setCustomers(data);
    setLoading(false);
  }, [search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const loadHistory = async (name: string) => {
    const params = new URLSearchParams({ customer: name, limit: '100' });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const res = await fetch('/api/sales?' + params);
    const data = await res.json();
    setHistory(data.data);
  };

  const selectCustomer = (c: Customer) => {
    setSelected(c);
    loadHistory(c.customer_name);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Customer list */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-2">
          <input placeholder="Search customer..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="w-full text-xs text-slate-500 border border-slate-200 rounded-lg py-1 hover:bg-slate-50">
              Clear date filter
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400">Loading...</div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
              {customers.map(c => (
                <button key={c.customer_name} onClick={() => selectCustomer(c)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected?.customer_name === c.customer_name ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{c.customer_name}</p>
                      <p className="text-xs text-slate-500">{c.address || '—'}</p>
                      {c.phone && <p className="text-xs text-blue-600">{c.phone}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-600">{fmtCur(c.total_amount)}</p>
                      {c.outstanding > 0 && (
                        <p className="text-xs text-rose-500">{fmtCur(c.outstanding)} due</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{c.total_orders} orders · {fmt(c.total_qty)} blocks · Last: {c.last_order}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Customer detail */}
      <div className="lg:col-span-3">
        {selected ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-base font-semibold text-slate-900">{selected.customer_name}</h2>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Orders', value: String(selected.total_orders) },
                  { label: 'Total Blocks', value: fmt(selected.total_qty) },
                  { label: 'Total Revenue', value: fmtCur(selected.total_amount) },
                  { label: 'Outstanding', value: fmtCur(selected.outstanding), red: selected.outstanding > 0 },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className={`text-lg font-bold ${stat.red ? 'text-rose-600' : 'text-slate-800'}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              {selected.phone && (
                <p className="mt-3 text-sm text-slate-600">
                  <span className="font-medium">Phone:</span> {selected.phone}
                </p>
              )}
              {selected.address && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Address:</span> {selected.address}
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">Order History</h3>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-xs text-slate-500">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2 text-right">Size</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Rate</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2">Mode</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(history as Record<string, unknown>[]).map(s => (
                      <tr key={s.id as number} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-500">{s.date as string}</td>
                        <td className="px-4 py-2 text-right">{s.size as number}&quot;</td>
                        <td className="px-4 py-2 text-right">{s.quantity as number}</td>
                        <td className="px-4 py-2 text-right">{s.rate ? `₹${s.rate}` : '—'}</td>
                        <td className="px-4 py-2 text-right font-medium">{fmtCur(s.amount as number)}</td>
                        <td className={`px-4 py-2 text-right ${(s.balance as number) > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                          {fmtCur(s.balance as number)}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{(s.payment_mode as string) || '—'}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs ${
                            s.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                            s.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{s.status as string}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center h-64 text-slate-400">
            Select a customer to view their history
          </div>
        )}
      </div>
    </div>
  );
}
