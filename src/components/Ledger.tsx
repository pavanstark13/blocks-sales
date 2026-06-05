'use client';

import { useEffect, useState, useCallback } from 'react';

interface LedgerEntry {
  id: number;
  date: string;
  address: string;
  size: number;
  quantity: number;
  rate: number;
  amount: number;
  advance: number;
  balance: number;
  status: string;
  payment_mode: string;
  notes: string;
  month_label: string;
  debit: number;
  credit: number;
  running_balance: number;
}

interface CustomerRow {
  customer_name: string;
  address: string;
  phone: string;
  orders: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
}

interface Summary {
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  total_orders: number;
  open_orders: number;
}

function fmtCur(n: number) {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n));
}

function fmt(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}

export default function Ledger() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [printing, setPrinting] = useState(false);

  // Load customer list
  useEffect(() => {
    fetch('/api/ledger').then(r => r.json()).then(d => setCustomers(d.customers));
  }, []);

  // Load ledger for selected customer
  const loadLedger = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    const res = await fetch(`/api/ledger?customer=${encodeURIComponent(name)}`);
    const data = await res.json();
    setEntries(data.entries);
    setSummary(data.summary);
    setLoading(false);
  }, []);

  useEffect(() => { if (selected) loadLedger(selected); }, [selected, loadLedger]);

  const filtered = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return !q || c.customer_name?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
      {/* Customer sidebar */}
      <div className="lg:col-span-1 print:hidden space-y-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3">
          <input
            placeholder="Search name, address, phone..."
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex justify-between text-xs text-slate-500">
            <span>Customer</span>
            <span>Balance</span>
          </div>
          <div className="divide-y divide-slate-50 max-h-[560px] overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.customer_name}
                onClick={() => setSelected(c.customer_name)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected === c.customer_name ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.customer_name}</p>
                    {c.address && <p className="text-xs text-slate-400 truncate">{c.address}</p>}
                    {c.phone && <p className="text-xs text-blue-500">{c.phone}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${c.closing_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {c.closing_balance > 0 ? fmtCur(c.closing_balance) : '✓'}
                    </p>
                    <p className="text-xs text-slate-400">{c.orders} orders</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ledger detail */}
      <div className="lg:col-span-3 space-y-4">
        {!selected ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center h-64 text-slate-400">
            Select a customer from the left to view their ledger
          </div>
        ) : loading ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center h-64 text-slate-400">
            Loading ledger...
          </div>
        ) : (
          <>
            {/* Ledger header */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 print:rounded-none print:border print:border-slate-300">
              <div className="flex items-start justify-between print:hidden">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selected}</h2>
                  {customers.find(c => c.customer_name === selected)?.address && (
                    <p className="text-sm text-slate-500">{customers.find(c => c.customer_name === selected)?.address}</p>
                  )}
                  {customers.find(c => c.customer_name === selected)?.phone && (
                    <p className="text-sm text-blue-600">{customers.find(c => c.customer_name === selected)?.phone}</p>
                  )}
                </div>
                <button onClick={handlePrint}
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                  Print Ledger
                </button>
              </div>

              {/* Print header */}
              <div className="hidden print:block text-center mb-4">
                <h1 className="text-2xl font-bold">BLOCKS SALES</h1>
                <h2 className="text-lg font-semibold mt-1">Customer Ledger</h2>
                <p className="text-base mt-1">{selected}</p>
                {customers.find(c => c.customer_name === selected)?.address && (
                  <p className="text-sm text-slate-600">{customers.find(c => c.customer_name === selected)?.address}</p>
                )}
                {customers.find(c => c.customer_name === selected)?.phone && (
                  <p className="text-sm">Ph: {customers.find(c => c.customer_name === selected)?.phone}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">Printed: {new Date().toLocaleDateString('en-IN')}</p>
                <hr className="mt-3" />
              </div>

              {/* Summary cards */}
              {summary && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-red-500 font-medium">Total Sales (Dr)</p>
                    <p className="text-lg font-bold text-red-700">{fmtCur(summary.total_debit)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-500 font-medium">Total Received (Cr)</p>
                    <p className="text-lg font-bold text-green-700">{fmtCur(summary.total_credit)}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${summary.closing_balance > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <p className={`text-xs font-medium ${summary.closing_balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      Closing Balance
                    </p>
                    <p className={`text-lg font-bold ${summary.closing_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {fmtCur(summary.closing_balance)}
                      <span className="text-xs ml-1">{summary.closing_balance > 0 ? 'Dr' : 'Cr'}</span>
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 font-medium">Orders</p>
                    <p className="text-lg font-bold text-slate-700">
                      {summary.total_orders}
                      {summary.open_orders > 0 && (
                        <span className="text-xs text-amber-600 ml-1">({summary.open_orders} open)</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Ledger table */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden print:rounded-none print:border print:border-slate-300">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 print:bg-slate-100">
                    <tr className="text-xs text-slate-600 font-semibold">
                      <th className="px-3 py-3 text-left w-8">#</th>
                      <th className="px-3 py-3 text-left">Date</th>
                      <th className="px-3 py-3 text-left">Particulars</th>
                      <th className="px-3 py-3 text-right">Size</th>
                      <th className="px-3 py-3 text-right">Qty</th>
                      <th className="px-3 py-3 text-right">Rate</th>
                      <th className="px-3 py-3 text-right text-red-600">Debit (₹)</th>
                      <th className="px-3 py-3 text-right text-green-600">Credit (₹)</th>
                      <th className="px-3 py-3 text-right">Balance (₹)</th>
                      <th className="px-3 py-3 text-center print:hidden">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {entries.map((e, i) => (
                      <tr key={e.id} className={`hover:bg-slate-50 ${(e.status === 'OPEN' || e.status === 'PENDING') ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{e.date}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">
                            {e.size}&quot; Blocks sold
                          </div>
                          <div className="text-xs text-slate-400">
                            {e.payment_mode && <span className="mr-2">{e.payment_mode}</span>}
                            {e.notes && <span>{e.notes}</span>}
                            {e.address && !e.notes && <span>{e.address}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{e.size}&quot;</td>
                        <td className="px-3 py-2 text-right">{fmt(e.quantity)}</td>
                        <td className="px-3 py-2 text-right">{e.rate ? `₹${e.rate}` : '—'}</td>
                        <td className="px-3 py-2 text-right font-medium text-red-600">
                          {e.debit > 0 ? fmtCur(e.debit) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-600">
                          {e.credit > 0 ? fmtCur(e.credit) : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${e.running_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {fmtCur(e.running_balance)}
                          <span className="text-xs ml-0.5">{e.running_balance > 0 ? 'Dr' : 'Cr'}</span>
                        </td>
                        <td className="px-3 py-2 text-center print:hidden">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            e.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                            e.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{e.status}</span>
                        </td>
                      </tr>
                    ))}

                    {/* Totals row */}
                    {summary && (
                      <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                        <td colSpan={6} className="px-3 py-3 text-sm text-right text-slate-600">TOTAL</td>
                        <td className="px-3 py-3 text-right text-red-700">{fmtCur(summary.total_debit)}</td>
                        <td className="px-3 py-3 text-right text-green-700">{fmtCur(summary.total_credit)}</td>
                        <td className={`px-3 py-3 text-right ${summary.closing_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {fmtCur(summary.closing_balance)}
                          <span className="text-xs ml-0.5 font-normal">{summary.closing_balance > 0 ? 'Dr' : 'Cr'}</span>
                        </td>
                        <td className="print:hidden" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print footer */}
            <div className="hidden print:block mt-8 pt-4 border-t border-slate-300 text-xs text-slate-500 text-center">
              This is a computer-generated ledger statement from BLOCKS SALES Manager.
            </div>
          </>
        )}
      </div>

      {printing && (
        <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
      )}
    </div>
  );
}
