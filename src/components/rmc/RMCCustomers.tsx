'use client';

import { useState, useEffect, useCallback } from 'react';

interface Customer {
  customer_name: string;
  order_count: number;
  total_quantity: number;
  total_amount: number;
  total_advance: number;
  total_balance: number;
  qty_m10: number;
  qty_m15: number;
  qty_m20: number;
  qty_m25: number;
  qty_m30: number;
  qty_m35: number;
  qty_m40: number;
  last_order_date: string;
}

interface LedgerEntry {
  row_type: 'sale' | 'payment';
  id: number;
  date: string;
  grade?: string;
  quantity?: number;
  total_amount?: number;
  debit: number;
  credit: number;
  running_balance: number;
  status?: string;
  site_address?: string;
  notes?: string;
  payment_mode?: string;
}

interface LedgerSummary {
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  total_orders: number;
  open_orders: number;
  payment_count: number;
  total_payments: number;
}

function fmtCur(n: number | null | undefined) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const GRADE_CHIPS: Record<string, string> = {
  M10: 'bg-slate-100 text-slate-700 border-slate-200',
  M15: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  M20: 'bg-blue-50 text-blue-700 border-blue-200',
  M25: 'bg-violet-50 text-violet-700 border-violet-200',
  M30: 'bg-purple-50 text-purple-700 border-purple-200',
  M35: 'bg-rose-50 text-rose-700 border-rose-200',
  M40: 'bg-orange-50 text-orange-700 border-orange-200',
};

const GRADES = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40'] as const;
const GRADE_QTY_KEYS: Record<string, keyof Customer> = {
  M10: 'qty_m10', M15: 'qty_m15', M20: 'qty_m20', M25: 'qty_m25', M30: 'qty_m30', M35: 'qty_m35', M40: 'qty_m40',
};

export default function RMCCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Detail panel state
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Payment form
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });
  const [payResult, setPayResult] = useState<string | null>(null);
  const [payingCustomer, setPayingCustomer] = useState(false);

  // Rate editing
  const [editingRate, setEditingRate] = useState<{ grade: string; val: string } | null>(null);

  // Credit limit
  const [creditLimit, setCreditLimit] = useState<number | null>(null);
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [savingCreditLimit, setSavingCreditLimit] = useState(false);
  const [creditLimitSaved, setCreditLimitSaved] = useState(false);

  // Merge/rename
  const [showMerge, setShowMerge] = useState(false);
  const [mergeForm, setMergeForm] = useState({ new_name: '', merge_into: '' });
  const [mergeMode, setMergeMode] = useState<'rename' | 'merge'>('rename');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search)      p.set('search', search);
    if (dateFrom)    p.set('date_from', dateFrom);
    if (dateTo)      p.set('date_to', dateTo);
    if (gradeFilter) p.set('grade', gradeFilter);
    try {
      const res = await fetch('/api/rmc/customers?' + p.toString());
      setCustomers(await res.json());
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo, gradeFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const fetchDetail = useCallback(async (name: string) => {
    setLoadingDetail(true);
    const [ledgerRes, ratesRes, creditRes] = await Promise.all([
      fetch(`/api/rmc/ledger?customer_name=${encodeURIComponent(name)}`),
      fetch(`/api/rmc/customer-rates?customer=${encodeURIComponent(name)}`),
      fetch(`/api/credit-limits?module=rmc&customer_name=${encodeURIComponent(name)}`),
    ]);
    const ledgerData = await ledgerRes.json();
    const ratesData = await ratesRes.json();
    const creditData = await creditRes.json();
    setLedger(ledgerData.entries || []);
    setLedgerSummary(ledgerData.summary || null);
    setRates(ratesData.rates || {});
    if (creditData.length > 0) {
      setCreditLimit(Number(creditData[0].credit_limit));
      setCreditLimitInput(String(creditData[0].credit_limit));
    } else {
      setCreditLimit(null);
      setCreditLimitInput('');
    }
    setLoadingDetail(false);
  }, []);

  const saveCreditLimit = async () => {
    if (!selected || !creditLimitInput) return;
    setSavingCreditLimit(true);
    await fetch('/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: selected, module: 'rmc', credit_limit: parseFloat(creditLimitInput) }),
    });
    setSavingCreditLimit(false);
    setCreditLimitSaved(true);
    setCreditLimit(parseFloat(creditLimitInput));
    setTimeout(() => setCreditLimitSaved(false), 2000);
  };

  const selectCustomer = (name: string) => {
    if (selected === name) { setSelected(null); return; }
    setSelected(name);
    setPayResult(null);
    setShowMerge(false);
    fetchDetail(name);
  };

  const saveRate = async (grade: string, rate: number) => {
    if (!selected) return;
    await fetch('/api/rmc/customer-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: selected, grade, rate }),
    });
    setRates(prev => ({ ...prev, [grade]: rate }));
    setEditingRate(null);
  };

  const deleteRate = async (grade: string) => {
    if (!selected) return;
    await fetch(`/api/rmc/customer-rates?customer=${encodeURIComponent(selected)}&grade=${grade}`, { method: 'DELETE' });
    setRates(prev => { const r = { ...prev }; delete r[grade]; return r; });
  };

  const submitPayment = async () => {
    if (!selected) return;
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) return;
    setPayingCustomer(true);
    const res = await fetch('/api/rmc/customers/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: selected,
        amount: amt,
        date: payForm.date,
        payment_mode: payForm.mode,
        notes: payForm.notes,
      }),
    });
    const result = await res.json();
    setPayingCustomer(false);
    setPayResult(`Payment saved. ${result.orders_updated} orders updated, leftover: ${fmtCur(result.leftover)}`);
    setPayForm({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'CASH', notes: '' });
    fetchCustomers();
    fetchDetail(selected);
  };

  const submitMerge = async () => {
    if (!selected) return;
    const body = mergeMode === 'rename'
      ? { old_name: selected, new_name: mergeForm.new_name.trim() }
      : { old_name: selected, merge_into: mergeForm.merge_into.trim() };

    if (mergeMode === 'rename' && !mergeForm.new_name.trim()) return;
    if (mergeMode === 'merge' && !mergeForm.merge_into.trim()) return;

    await fetch('/api/rmc/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const newName = mergeMode === 'rename' ? mergeForm.new_name.trim() : mergeForm.merge_into.trim();
    setSelected(newName);
    setShowMerge(false);
    setMergeForm({ new_name: '', merge_into: '' });
    fetchCustomers();
    fetchDetail(newName);
  };

  const printLedger = () => {
    window.print();
  };

  const selectedCustomer = customers.find(c => c.customer_name === selected);

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Customer name..." className={inputCls + ' w-full'} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Filter by Grade</label>
          <div className="flex gap-1">
            <button onClick={() => setGradeFilter('')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${gradeFilter === '' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              All
            </button>
            {GRADES.map(g => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${gradeFilter === g ? 'bg-purple-600 text-white border-purple-600' : `${GRADE_CHIPS[g]} hover:opacity-80`}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
        </div>
        <span className="text-xs text-slate-500 self-end pb-1">{customers.length} customers</span>
      </div>

      {loading && <div className="text-center py-8 text-slate-400">Loading...</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer List */}
        <div className="lg:col-span-1 space-y-2">
          {customers.map(c => (
            <button
              key={c.customer_name}
              onClick={() => selectCustomer(c.customer_name)}
              className={`w-full text-left bg-white rounded-xl border shadow-sm p-4 hover:border-purple-300 transition-colors ${selected === c.customer_name ? 'border-purple-400 ring-2 ring-purple-100' : 'border-slate-100'}`}
            >
              <div className="flex justify-between items-start">
                <span className="font-semibold text-slate-800 text-sm">{c.customer_name}</span>
                <span className={`text-sm font-bold ${Number(c.total_balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {fmtCur(c.total_balance)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">{c.order_count} orders</span>
                <span className="text-xs text-purple-600 font-medium">{Number(c.total_quantity).toFixed(1)} m³</span>
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {GRADES.map(g => {
                  const qty = Number(c[GRADE_QTY_KEYS[g]]);
                  if (!qty) return null;
                  return (
                    <span key={g} className={`text-xs px-1.5 py-0.5 rounded border ${GRADE_CHIPS[g]}`}>
                      {g}: {qty.toFixed(1)}
                    </span>
                  );
                })}
              </div>
            </button>
          ))}
          {!loading && customers.length === 0 && (
            <p className="text-center text-slate-400 py-8">No customers found</p>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="lg:col-span-2 space-y-4">
            {loadingDetail ? (
              <div className="text-center py-12 text-slate-400">Loading details...</div>
            ) : (
              <>
                {/* Customer Header */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="text-lg font-bold text-slate-800">{selected}</h2>
                    <button onClick={() => { setShowMerge(!showMerge); setMergeForm({ new_name: selected, merge_into: '' }); }}
                      className="text-xs px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                      Edit / Merge
                    </button>
                  </div>

                  {/* Summary row */}
                  {selectedCustomer && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div className="bg-purple-50 rounded-lg p-2.5">
                        <p className="text-xs text-slate-500">Total Volume</p>
                        <p className="text-base font-bold text-purple-600">{Number(selectedCustomer.total_quantity).toFixed(1)} m³</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-xs text-slate-500">Total Amount</p>
                        <p className="text-base font-bold text-slate-700">{fmtCur(selectedCustomer.total_amount)}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-2.5">
                        <p className="text-xs text-slate-500">Total Paid</p>
                        <p className="text-base font-bold text-emerald-600">{fmtCur(selectedCustomer.total_advance)}</p>
                      </div>
                      <div className="bg-rose-50 rounded-lg p-2.5">
                        <p className="text-xs text-slate-500">Outstanding</p>
                        <p className="text-base font-bold text-rose-600">{fmtCur(selectedCustomer.total_balance)}</p>
                      </div>
                    </div>
                  )}

                  {/* Credit Limit */}
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    {creditLimit != null && selectedCustomer && (
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm border ${Number(selectedCustomer.total_balance) >= creditLimit ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-xs text-slate-500">Credit Limit:</span>
                        <span className="font-semibold text-slate-700">{fmtCur(creditLimit)}</span>
                        {Number(selectedCustomer.total_balance) >= creditLimit && (
                          <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">⚠ EXCEEDED</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Set credit limit (₹)"
                        value={creditLimitInput}
                        onChange={e => setCreditLimitInput(e.target.value)}
                        className="w-44 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        onClick={saveCreditLimit}
                        disabled={savingCreditLimit || !creditLimitInput}
                        className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {savingCreditLimit ? 'Saving...' : creditLimitSaved ? '✓ Saved' : 'Set Limit'}
                      </button>
                    </div>
                  </div>

                  {/* Grade chips */}
                  <div className="flex gap-2 flex-wrap">
                    {GRADES.map(g => {
                      const qty = Number(selectedCustomer?.[GRADE_QTY_KEYS[g]] || 0);
                      if (!qty) return null;
                      return (
                        <span key={g} className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${GRADE_CHIPS[g]}`}>
                          {g}: {qty.toFixed(1)} m³
                        </span>
                      );
                    })}
                  </div>

                  {/* Merge/rename panel */}
                  {showMerge && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex gap-2 mb-3">
                        <button onClick={() => setMergeMode('rename')}
                          className={`text-xs px-3 py-1 rounded-lg font-medium ${mergeMode === 'rename' ? 'bg-purple-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                          Rename
                        </button>
                        <button onClick={() => setMergeMode('merge')}
                          className={`text-xs px-3 py-1 rounded-lg font-medium ${mergeMode === 'merge' ? 'bg-purple-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                          Merge Into
                        </button>
                      </div>
                      {mergeMode === 'rename' && (
                        <div className="flex gap-2">
                          <input type="text" value={mergeForm.new_name}
                            onChange={e => setMergeForm(f => ({ ...f, new_name: e.target.value }))}
                            placeholder="New name" className={inputCls + ' flex-1'} />
                          <button onClick={submitMerge} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Rename</button>
                          <button onClick={() => setShowMerge(false)} className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                        </div>
                      )}
                      {mergeMode === 'merge' && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">Merge <strong>{selected}</strong> into:</p>
                          <div className="flex gap-2">
                            <input type="text" value={mergeForm.merge_into}
                              onChange={e => setMergeForm(f => ({ ...f, merge_into: e.target.value }))}
                              placeholder="Target customer name" className={inputCls + ' flex-1'} />
                            <button onClick={submitMerge} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700">Merge</button>
                            <button onClick={() => setShowMerge(false)} className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rates */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Saved Rates</h3>
                  <div className="flex flex-wrap gap-2">
                    {GRADES.map(g => {
                      const savedRate = rates[g];
                      const isEditing = editingRate?.grade === g;
                      return (
                        <div key={g} className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 ${GRADE_CHIPS[g]}`}>
                          <span className="font-semibold">{g}</span>
                          {isEditing ? (
                            <>
                              <input type="number"
                                value={editingRate.val}
                                onChange={e => setEditingRate({ grade: g, val: e.target.value })}
                                className="w-20 border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                                autoFocus
                              />
                              <button onClick={() => saveRate(g, parseFloat(editingRate.val))}
                                className="text-emerald-600 font-bold">✓</button>
                              <button onClick={() => setEditingRate(null)} className="text-slate-400">✕</button>
                            </>
                          ) : savedRate ? (
                            <>
                              <span>₹{savedRate.toLocaleString('en-IN')}</span>
                              <button onClick={() => setEditingRate({ grade: g, val: String(savedRate) })}
                                className="text-slate-400 hover:text-purple-600">✏</button>
                              <button onClick={() => deleteRate(g)} className="text-slate-300 hover:text-rose-500">×</button>
                            </>
                          ) : (
                            <button onClick={() => setEditingRate({ grade: g, val: '' })}
                              className="text-slate-400 hover:text-purple-600">+ Set rate</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bulk Payment */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Record Payment</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Amount *</label>
                      <input type="number" value={payForm.amount}
                        onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0" className={inputCls + ' w-full'} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                      <input type="date" value={payForm.date}
                        onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
                        className={inputCls + ' w-full'} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Mode</label>
                      <select value={payForm.mode} onChange={e => setPayForm(p => ({ ...p, mode: e.target.value }))}
                        className={inputCls + ' w-full'}>
                        <option>CASH</option><option>NY A/C</option><option>MKL A/C</option><option>KMK A/C</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                      <input type="text" value={payForm.notes}
                        onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Optional" className={inputCls + ' w-full'} />
                    </div>
                  </div>
                  <button onClick={submitPayment} disabled={payingCustomer || !payForm.amount}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                    {payingCustomer ? 'Saving...' : 'Save Payment'}
                  </button>
                  {payResult && <p className="text-sm text-emerald-600 mt-2">{payResult}</p>}
                </div>

                {/* Ledger */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 print:shadow-none print:border-none">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">Ledger</h3>
                    <button onClick={printLedger} className="text-xs px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 print:hidden">
                      Print
                    </button>
                  </div>

                  {ledgerSummary && (
                    <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-slate-500">Total Debit</p>
                        <p className="font-bold text-slate-700">{fmtCur(ledgerSummary.total_debit)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-slate-500">Total Credit</p>
                        <p className="font-bold text-emerald-600">{fmtCur(ledgerSummary.total_credit)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-slate-500">Closing Balance</p>
                        <p className={`font-bold ${ledgerSummary.closing_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {fmtCur(ledgerSummary.closing_balance)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 font-semibold border-b border-slate-100">
                          <th className="pb-2 pr-3">Date</th>
                          <th className="pb-2 pr-3">Type</th>
                          <th className="pb-2 pr-3">Details</th>
                          <th className="pb-2 pr-3 text-right">Debit</th>
                          <th className="pb-2 pr-3 text-right">Credit</th>
                          <th className="pb-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {ledger.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-4 text-slate-400">No entries</td></tr>
                        )}
                        {ledger.map((e, i) => (
                          <tr key={i} className={e.row_type === 'payment' ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}>
                            <td className="py-1.5 pr-3 text-slate-500">{e.date}</td>
                            <td className="py-1.5 pr-3">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${e.row_type === 'sale' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {e.row_type === 'sale' ? 'SALE' : 'PMT'}
                              </span>
                            </td>
                            <td className="py-1.5 pr-3 text-slate-600">
                              {e.row_type === 'sale'
                                ? `${e.grade} ${Number(e.quantity).toFixed(1)}m³${e.site_address ? ` · ${e.site_address}` : ''}`
                                : e.notes || e.payment_mode || 'Payment'
                              }
                            </td>
                            <td className="py-1.5 pr-3 text-right text-slate-700 font-medium">
                              {e.debit > 0 ? fmtCur(e.debit) : ''}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-emerald-600 font-medium">
                              {e.credit > 0 ? fmtCur(e.credit) : ''}
                            </td>
                            <td className={`py-1.5 text-right font-bold ${e.running_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {fmtCur(e.running_balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
