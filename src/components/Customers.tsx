'use client';

import { useEffect, useState, useCallback } from 'react';

interface Customer {
  customer_name: string;
  address: string;
  phone: string;
  total_orders: number;
  total_qty: number;
  qty_4: number;
  qty_6: number;
  qty_8: number;
  total_amount: number;
  outstanding: number;
  last_order: string;
}

interface CustomerRates { 4?: number; 6?: number; 8?: number; }

interface RatePeriod {
  id: number;
  size: number;
  rate: number;
  date_from: string;
  date_to: string;
}

function fmtCur(n: number | null) {
  if (n == null) return '—';
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}
function fmt(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}

const today = new Date().toISOString().split('T')[0];

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<unknown[]>([]);

  // Fixed rates
  const [rates, setRates] = useState<CustomerRates>({});
  const [rateInputs, setRateInputs] = useState<{ 4: string; 6: string; 8: string }>({ 4: '', 6: '', 8: '' });
  const [savingRates, setSavingRates] = useState(false);
  const [ratesSaved, setRatesSaved] = useState(false);

  // Rate periods
  const [ratePeriods, setRatePeriods] = useState<RatePeriod[]>([]);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [periodSize, setPeriodSize] = useState<'4'|'6'|'8'>('6');
  const [periodRate, setPeriodRate] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState(today);
  const [applyToOrders, setApplyToOrders] = useState(true);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [periodSaveMsg, setPeriodSaveMsg] = useState('');

  // Bulk payment
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(today);
  const [payMode, setPayMode] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);
  const [payResult, setPayResult] = useState<{ orders_updated: number; amount_applied: number; leftover: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)   params.set('q', search);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const data = await fetch('/api/customers?' + params).then(r => r.json());
    setCustomers(data);
    setLoading(false);
  }, [search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const loadHistory = useCallback(async (name: string) => {
    const params = new URLSearchParams({ customer: name, limit: '200' });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    const data = await fetch('/api/sales?' + params).then(r => r.json());
    setHistory(data.data);
  }, [dateFrom, dateTo]);

  const loadRates = async (name: string) => {
    const data = await fetch(`/api/customer-rates?customer=${encodeURIComponent(name)}`).then(r => r.json());
    const r = data.rates as CustomerRates;
    setRates(r);
    setRateInputs({ 4: r[4] != null ? String(r[4]) : '', 6: r[6] != null ? String(r[6]) : '', 8: r[8] != null ? String(r[8]) : '' });
  };

  const loadRatePeriods = async (name: string) => {
    const data = await fetch(`/api/customer-rate-periods?customer=${encodeURIComponent(name)}`).then(r => r.json());
    setRatePeriods(data);
  };

  const selectCustomer = (c: Customer) => {
    setSelected(c);
    setPayResult(null);
    setPayAmount('');
    setShowAddPeriod(false);
    setPeriodSaveMsg('');
    loadHistory(c.customer_name);
    loadRates(c.customer_name);
    loadRatePeriods(c.customer_name);
  };

  const saveFixedRates = async () => {
    if (!selected) return;
    setSavingRates(true);
    await Promise.all(([4, 6, 8] as const).map(size => {
      const val = parseFloat(rateInputs[size]);
      if (!val || val <= 0) return Promise.resolve();
      return fetch('/api/customer-rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: selected.customer_name, size, rate: val }),
      });
    }));
    await loadRates(selected.customer_name);
    setSavingRates(false);
    setRatesSaved(true);
    setTimeout(() => setRatesSaved(false), 2000);
  };

  const saveRatePeriod = async () => {
    if (!selected || !periodRate || !periodFrom || !periodTo) return;
    setSavingPeriod(true);
    const res = await fetch('/api/customer-rate-periods', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: selected.customer_name,
        size: parseInt(periodSize),
        rate: parseFloat(periodRate),
        date_from: periodFrom,
        date_to: periodTo,
        apply_to_orders: applyToOrders,
      }),
    });
    const result = await res.json();
    setSavingPeriod(false);
    setPeriodSaveMsg(
      result.ok
        ? `Saved${result.orders_updated > 0 ? ` · ${result.orders_updated} orders updated` : ''}`
        : 'Error saving'
    );
    await loadRatePeriods(selected.customer_name);
    setPeriodRate(''); setPeriodFrom('');
    setShowAddPeriod(false);
    setTimeout(() => setPeriodSaveMsg(''), 3000);
  };

  const deleteRatePeriod = async (id: number) => {
    await fetch(`/api/customer-rate-periods?id=${id}`, { method: 'DELETE' });
    if (selected) loadRatePeriods(selected.customer_name);
  };

  const handleBulkPay = async () => {
    if (!selected || !payAmount || parseFloat(payAmount) <= 0) return;
    setPaying(true);
    setPayResult(null);
    const res = await fetch('/api/customers/payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: selected.customer_name,
        amount: parseFloat(payAmount),
        date: payDate,
        payment_mode: payMode,
        notes: payNotes || undefined,
      }),
    });
    const result = await res.json();
    setPayResult(result);
    setPaying(false);
    setPayAmount('');
    setPayNotes('');
    load();
    loadHistory(selected.customer_name);
  };

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Customer list */}
      <div className="lg:col-span-2 space-y-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-2">
          <input placeholder="Search customer..." value={search}
            onChange={e => setSearch(e.target.value)} className={`w-full ${inputCls}`} />
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
                      {c.outstanding > 0 && <p className="text-xs text-rose-500">{fmtCur(c.outstanding)} due</p>}
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
      <div className="lg:col-span-3 space-y-4">
        {selected ? (
          <>
            {/* Summary */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-base font-semibold text-slate-900">{selected.customer_name}</h2>
              {selected.phone && <p className="text-sm text-blue-600 mt-0.5">{selected.phone}</p>}
              {selected.address && <p className="text-sm text-slate-500">{selected.address}</p>}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              {(selected.qty_4 > 0 || selected.qty_6 > 0 || selected.qty_8 > 0) && (
                <div className="mt-3 flex gap-3 flex-wrap">
                  {selected.qty_4 > 0 && (
                    <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-semibold text-blue-700">4&quot;</span>
                      <span className="text-sm font-bold text-blue-800">{fmt(selected.qty_4)}</span>
                      <span className="text-xs text-blue-500">blocks</span>
                    </div>
                  )}
                  {selected.qty_6 > 0 && (
                    <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-semibold text-emerald-700">6&quot;</span>
                      <span className="text-sm font-bold text-emerald-800">{fmt(selected.qty_6)}</span>
                      <span className="text-xs text-emerald-500">blocks</span>
                    </div>
                  )}
                  {selected.qty_8 > 0 && (
                    <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-semibold text-amber-700">8&quot;</span>
                      <span className="text-sm font-bold text-amber-800">{fmt(selected.qty_8)}</span>
                      <span className="text-xs text-amber-500">blocks</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rates section */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Rate Management</h3>

              {/* Fixed (default) rates */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Default rate (auto-filled in Daily Entry unless a period rate applies)</p>
                <div className="flex gap-3 flex-wrap items-end">
                  {([4, 6, 8] as const).map(size => (
                    <div key={size}>
                      <label className="block text-xs text-slate-500 mb-1">{size}&quot; Block (₹)</label>
                      <input type="number" step="0.5"
                        placeholder={rates[size] ? String(rates[size]) : 'Not set'}
                        value={rateInputs[size]}
                        onChange={e => setRateInputs(p => ({ ...p, [size]: e.target.value }))}
                        className={`w-24 ${inputCls} ${rates[size] ? 'border-blue-300 bg-blue-50/30' : ''}`}
                      />
                      {rates[size] && <p className="text-xs text-blue-600 mt-0.5">₹{rates[size]}</p>}
                    </div>
                  ))}
                  <button onClick={saveFixedRates} disabled={savingRates}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 self-end">
                    {savingRates ? 'Saving...' : ratesSaved ? '✓ Saved' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Rate periods */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500">Date-range rates (override default for a specific period)</p>
                  <button onClick={() => setShowAddPeriod(v => !v)}
                    className="text-xs text-blue-600 hover:underline">
                    {showAddPeriod ? 'Cancel' : '+ Add period'}
                  </button>
                </div>

                {showAddPeriod && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 space-y-2 mb-3">
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Size</label>
                        <select value={periodSize} onChange={e => setPeriodSize(e.target.value as '4'|'6'|'8')}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="4">4&quot;</option>
                          <option value="6">6&quot;</option>
                          <option value="8">8&quot;</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Rate (₹)</label>
                        <input type="number" step="0.5" placeholder="e.g. 44" value={periodRate}
                          onChange={e => setPeriodRate(e.target.value)}
                          className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">From date</label>
                        <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">To date</label>
                        <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={applyToOrders} onChange={e => setApplyToOrders(e.target.checked)}
                        className="rounded" />
                      Update rate on all existing orders within this date range
                    </label>
                    <button onClick={saveRatePeriod} disabled={savingPeriod || !periodRate || !periodFrom}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {savingPeriod ? 'Saving...' : 'Save Rate Period'}
                    </button>
                    {periodSaveMsg && <p className="text-xs text-emerald-600 font-medium">{periodSaveMsg}</p>}
                  </div>
                )}

                {ratePeriods.length > 0 ? (
                  <table className="w-full text-xs border border-slate-100 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2">Size</th>
                        <th className="px-3 py-2">Rate</th>
                        <th className="px-3 py-2">From</th>
                        <th className="px-3 py-2">To</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {ratePeriods.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">{p.size}&quot;</td>
                          <td className="px-3 py-2 text-blue-700 font-semibold">₹{p.rate}</td>
                          <td className="px-3 py-2 text-slate-500">{p.date_from}</td>
                          <td className="px-3 py-2 text-slate-500">{p.date_to}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => deleteRatePeriod(p.id)}
                              className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-slate-400 italic">No date-range rates set.</p>
                )}
              </div>
            </div>

            {/* Bulk payment */}
            {selected.outstanding > 0 && (
              <div className="bg-white rounded-xl border border-rose-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Record Bulk Payment</h3>
                  <span className="text-sm font-bold text-rose-600">{fmtCur(selected.outstanding)} outstanding</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Distributed to oldest open orders first. Saved in ledger with date + mode.
                </p>
                <div className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
                    <input type="number" placeholder="Enter amount..." value={payAmount}
                      onChange={e => setPayAmount(e.target.value)} className={`w-36 ${inputCls}`} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Date</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Mode</label>
                    <select value={payMode} onChange={e => setPayMode(e.target.value)} className={inputCls}>
                      <option>CASH</option>
                      <option>NY A/C</option>
                      <option>MKL A/C</option>
                      <option>KMK A/C</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                    <input type="text" placeholder="Cheque no., etc." value={payNotes}
                      onChange={e => setPayNotes(e.target.value)} className={`w-44 ${inputCls}`} />
                  </div>
                  <button onClick={handleBulkPay} disabled={paying || !payAmount}
                    className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium self-end">
                    {paying ? 'Processing...' : 'Record Payment'}
                  </button>
                </div>
                {payResult && (
                  <div className={`mt-3 rounded-lg p-3 text-sm ${payResult.leftover > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                    <span className="font-semibold">{fmtCur(payResult.amount_applied)} applied</span>{' '}
                    across {payResult.orders_updated} order{payResult.orders_updated !== 1 ? 's' : ''}.
                    {payResult.leftover > 0 && (
                      <span className="ml-1">⚠ {fmtCur(payResult.leftover)} leftover (no more open orders).</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Order history */}
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
                            s.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>{s.status as string}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center h-64 text-slate-400">
            Select a customer to view their history
          </div>
        )}
      </div>
    </div>
  );
}
