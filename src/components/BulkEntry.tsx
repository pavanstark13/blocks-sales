'use client';

import { useState, useRef, useCallback } from 'react';

interface Row {
  customer_name: string;
  address: string;
  phone: string;
  size: string;
  quantity: string;
  rate: string;
  advance: string;
  payment_mode: string;
  status: string;
}

const emptyRow = (): Row => ({
  customer_name: '', address: '', phone: '',
  size: '6', quantity: '', rate: '', advance: '0',
  payment_mode: 'CASH', status: 'CLOSED',
});

function calcAmount(r: Row) {
  const qty = parseFloat(r.quantity);
  const rate = parseFloat(r.rate);
  return qty > 0 && rate > 0 ? qty * rate : null;
}

function calcBalance(r: Row) {
  const amt = calcAmount(r);
  return amt != null ? Math.max(0, amt - parseFloat(r.advance || '0')) : null;
}

function fmtCur(n: number | null) {
  if (n == null) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const COLS = ['customer_name','address','phone','size','quantity','rate','advance','payment_mode','status'];

export default function BulkEntry({ onSaved }: { onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; errors: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const setCell = (i: number, key: keyof Row, val: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  };

  const addRow = useCallback(() => {
    setRows(prev => [...prev, emptyRow()]);
  }, []);

  const removeRow = (i: number) => {
    setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  };

  // Tab/Enter keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey && colIdx === COLS.length - 1)) {
      e.preventDefault();
      if (rowIdx === rows.length - 1) addRow();
      setTimeout(() => {
        const nextRow = tableRef.current?.querySelectorAll('tr[data-row]')[rowIdx + 1];
        (nextRow?.querySelectorAll('input,select')[0] as HTMLElement)?.focus();
      }, 50);
    }
  };

  const totalAmount = rows.reduce((s, r) => s + (calcAmount(r) || 0), 0);
  const totalQty = rows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
  const filledRows = rows.filter(r => r.quantity && parseFloat(r.quantity) > 0);

  const handleSave = async () => {
    if (!filledRows.length) return;
    setSaving(true);
    setResult(null);
    let saved = 0, errors = 0;

    await Promise.all(filledRows.map(async row => {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date, customer_name: row.customer_name || null,
            address: row.address || null, phone: row.phone || null,
            size: parseInt(row.size), quantity: parseInt(row.quantity),
            rate: parseFloat(row.rate) || null,
            advance: parseFloat(row.advance) || 0,
            payment_mode: row.payment_mode, status: row.status,
          }),
        });
        if (res.ok) saved++; else errors++;
      } catch { errors++; }
    }));

    setSaving(false);
    setResult({ saved, errors });
    if (saved > 0) {
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      onSaved();
    }
  };

  const inputCls = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date for all entries</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex-1 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{filledRows.length}</span> orders ·{' '}
          <span className="font-semibold text-slate-700">{totalQty.toLocaleString('en-IN')}</span> blocks ·{' '}
          <span className="font-semibold text-blue-600">{fmtCur(totalAmount)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={addRow}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            + Add Row
          </button>
          <button onClick={handleSave} disabled={saving || filledRows.length === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? `Saving ${filledRows.length} orders...` : `Save All (${filledRows.length})`}
          </button>
        </div>
      </div>

      {result && (
        <div className={`rounded-xl p-4 text-sm font-medium ${result.errors === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {result.saved > 0 && `✓ ${result.saved} orders saved successfully. `}
          {result.errors > 0 && `⚠ ${result.errors} failed.`}
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-500 font-semibold">
                <th className="px-3 py-2 w-6">#</th>
                <th className="px-2 py-2 min-w-36">Customer Name</th>
                <th className="px-2 py-2 min-w-28">Address</th>
                <th className="px-2 py-2 min-w-28">Phone</th>
                <th className="px-2 py-2 w-16">Size</th>
                <th className="px-2 py-2 w-20">Qty *</th>
                <th className="px-2 py-2 w-20">Rate</th>
                <th className="px-2 py-2 w-24">Amount</th>
                <th className="px-2 py-2 w-24">Advance</th>
                <th className="px-2 py-2 w-20">Balance</th>
                <th className="px-2 py-2 w-24">Mode</th>
                <th className="px-2 py-2 w-24">Status</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, i) => {
                const amt = calcAmount(row);
                const bal = calcBalance(row);
                const filled = !!row.quantity && parseFloat(row.quantity) > 0;
                return (
                  <tr key={i} data-row={i}
                    className={`${filled ? 'bg-blue-50/30' : ''} hover:bg-slate-50`}>
                    <td className="px-3 py-1.5 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <input value={row.customer_name} onChange={e => setCell(i, 'customer_name', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 0)}
                        placeholder="Name" className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.address} onChange={e => setCell(i, 'address', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 1)}
                        placeholder="Village/area" className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.phone} onChange={e => setCell(i, 'phone', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 2)}
                        placeholder="Phone" className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.size} onChange={e => setCell(i, 'size', e.target.value)}
                        className={inputCls}>
                        <option value="4">4&quot;</option>
                        <option value="6">6&quot;</option>
                        <option value="8">8&quot;</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.quantity} onChange={e => setCell(i, 'quantity', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 4)}
                        placeholder="644" className={`${inputCls} ${filled ? 'font-semibold' : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.rate} onChange={e => setCell(i, 'rate', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 5)}
                        placeholder="42" step="0.5" className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-blue-700 text-xs">
                      {fmtCur(amt)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.advance} onChange={e => setCell(i, 'advance', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 7)}
                        placeholder="0" className={inputCls} />
                    </td>
                    <td className={`px-2 py-1.5 text-right text-xs font-medium ${bal && bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {fmtCur(bal)}
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.payment_mode} onChange={e => setCell(i, 'payment_mode', e.target.value)}
                        className={inputCls}>
                        <option>CASH</option>
                        <option>NY A/C</option>
                        <option>MKL A/C</option>
                        <option>KMK A/C</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.status} onChange={e => setCell(i, 'status', e.target.value)}
                        className={inputCls}>
                        <option>CLOSED</option>
                        <option>OPEN</option>
                        <option>PENDING</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeRow(i)}
                        className="text-slate-300 hover:text-red-500 text-lg leading-none">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button onClick={addRow}
            className="text-sm text-blue-600 hover:underline">
            + Add another row
          </button>
          <p className="text-xs text-slate-400">Tab → next cell · Enter → new row · Only rows with Qty are saved</p>
        </div>
      </div>
    </div>
  );
}
