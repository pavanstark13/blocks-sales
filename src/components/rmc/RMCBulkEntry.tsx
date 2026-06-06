'use client';

import { useState, useRef, useCallback } from 'react';

interface Row {
  customer_name: string;
  site_address: string;
  grade: string;
  quantity: string;
  rate: string;
  pump_charge: string;
  advance: string;
  payment_mode: string;
  status: string;
}

const GRADES = ['M10', 'M15', 'M20', 'M25', 'M30'];

const emptyRow = (): Row => ({
  customer_name: '', site_address: '',
  grade: 'M20', quantity: '', rate: '', pump_charge: '0', advance: '0',
  payment_mode: 'CASH', status: 'CLOSED',
});

function calcAmount(r: Row): number | null {
  const qty = parseFloat(r.quantity);
  const rate = parseFloat(r.rate);
  return qty > 0 && rate > 0 ? qty * rate : null;
}

function calcTotal(r: Row): number | null {
  const amt = calcAmount(r);
  const pc = parseFloat(r.pump_charge || '0') || 0;
  if (amt == null && pc === 0) return null;
  return (amt || 0) + pc;
}

function calcBalance(r: Row): number | null {
  const total = calcTotal(r);
  if (total == null) return null;
  return Math.max(0, total - (parseFloat(r.advance || '0') || 0));
}

function fmtCur(n: number | null) {
  if (n == null) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const COLS = ['customer_name','site_address','grade','quantity','rate','pump_charge','advance','payment_mode','status'];

export default function RMCBulkEntry({ onSaved }: { onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; errors: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const rateCache = useRef<Record<string, Record<string, number>>>({});

  const setCell = (i: number, key: keyof Row, val: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  };

  const handleCustomerBlur = useCallback(async (i: number, name: string) => {
    if (!name.trim()) return;
    try {
      const res = await fetch(`/api/rmc/customer-rates?customer=${encodeURIComponent(name)}`);
      const data = await res.json();
      const fetched = data.rates as Record<string, number>;
      rateCache.current[name] = fetched;
      setRows(prev => prev.map((r, idx) => {
        if (idx !== i) return r;
        const savedRate = fetched[r.grade];
        if (savedRate && !r.rate) return { ...r, rate: String(savedRate) };
        return r;
      }));
    } catch { /* ignore */ }
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, emptyRow()]);
  }, []);

  const removeRow = (i: number) => {
    setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  };

  // Add another grade row for same customer
  const duplicateCustomer = (i: number) => {
    const src = rows[i];
    const gradeIdx = GRADES.indexOf(src.grade);
    const nextGrade = GRADES[(gradeIdx + 1) % GRADES.length];
    const newRow: Row = {
      customer_name: src.customer_name,
      site_address: src.site_address,
      payment_mode: src.payment_mode,
      status: src.status,
      grade: nextGrade,
      quantity: '',
      rate: '',
      pump_charge: '0',
      advance: '0',
    };
    // Auto-fill rate from cache for next grade
    const cached = rateCache.current[src.customer_name];
    if (cached && cached[nextGrade]) {
      newRow.rate = String(cached[nextGrade]);
    }
    setRows(prev => {
      const next = [...prev];
      next.splice(i + 1, 0, newRow);
      return next;
    });
    setTimeout(() => {
      const trs = tableRef.current?.querySelectorAll('tr[data-row]');
      const newTr = trs?.[i + 1];
      const qtyInput = newTr?.querySelectorAll('input')[1] as HTMLElement;
      qtyInput?.focus();
    }, 50);
  };

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

  const filledRows = rows.filter(r => r.quantity && parseFloat(r.quantity) > 0);
  const totalQty = filledRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
  const totalAmount = filledRows.reduce((s, r) => s + (calcTotal(r) || 0), 0);

  const handleSave = async () => {
    if (!filledRows.length) return;
    setSaving(true);
    setResult(null);
    let saved = 0, errors = 0;

    await Promise.all(filledRows.map(async row => {
      try {
        const res = await fetch('/api/rmc/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            customer_name: row.customer_name || null,
            site_address: row.site_address || null,
            grade: row.grade,
            quantity: parseFloat(row.quantity),
            rate: parseFloat(row.rate) || null,
            pump_charge: parseFloat(row.pump_charge) || 0,
            advance: parseFloat(row.advance) || 0,
            payment_mode: row.payment_mode,
            status: row.status,
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

  const inputCls = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date for all entries</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <div className="flex-1 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{filledRows.length}</span> rows ·{' '}
          <span className="font-semibold text-slate-700">{totalQty.toFixed(1)}</span> m³ ·{' '}
          <span className="font-semibold text-purple-600">{fmtCur(totalAmount)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={addRow}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            + Add Row
          </button>
          <button onClick={handleSave} disabled={saving || filledRows.length === 0}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium">
            {saving ? `Saving ${filledRows.length} rows...` : `Save All (${filledRows.length})`}
          </button>
        </div>
      </div>

      {result && (
        <div className={`rounded-xl p-4 text-sm font-medium ${result.errors === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {result.saved > 0 && `✓ ${result.saved} entries saved. `}
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
                <th className="px-2 py-2 min-w-28">Site Address</th>
                <th className="px-2 py-2 w-20">Grade</th>
                <th className="px-2 py-2 w-20">Qty m³ *</th>
                <th className="px-2 py-2 w-20">Rate</th>
                <th className="px-2 py-2 w-24">Amount</th>
                <th className="px-2 py-2 w-20">Pump</th>
                <th className="px-2 py-2 w-24">Total</th>
                <th className="px-2 py-2 w-20">Advance</th>
                <th className="px-2 py-2 w-20">Balance</th>
                <th className="px-2 py-2 w-24">Mode</th>
                <th className="px-2 py-2 w-24">Status</th>
                <th className="px-2 py-2 w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, i) => {
                const amt = calcAmount(row);
                const total = calcTotal(row);
                const bal = calcBalance(row);
                const filled = !!row.quantity && parseFloat(row.quantity) > 0;
                const isSameCustomer = i > 0 && row.customer_name && row.customer_name === rows[i - 1].customer_name;

                return (
                  <tr key={i} data-row={i}
                    className={`${isSameCustomer ? 'bg-purple-50/40 border-l-2 border-purple-300' : filled ? 'bg-purple-50/10' : ''} hover:bg-slate-50`}>
                    <td className="px-3 py-1.5 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      {isSameCustomer ? (
                        <span className="text-xs text-purple-600 font-medium truncate max-w-28 block" title={row.customer_name}>
                          ↳ {row.customer_name}
                        </span>
                      ) : (
                        <input value={row.customer_name}
                          onChange={e => setCell(i, 'customer_name', e.target.value)}
                          onBlur={e => handleCustomerBlur(i, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, i, 0)}
                          placeholder="Name" className={inputCls} />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {isSameCustomer ? (
                        <span className="text-xs text-slate-400 italic">same</span>
                      ) : (
                        <input value={row.site_address}
                          onChange={e => setCell(i, 'site_address', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, i, 1)}
                          placeholder="Site/village" className={inputCls} />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.grade} onChange={e => {
                        const newGrade = e.target.value;
                        setCell(i, 'grade', newGrade);
                        const cached = rateCache.current[row.customer_name];
                        if (cached && cached[newGrade]) {
                          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, grade: newGrade, rate: String(cached[newGrade]) } : r));
                        }
                      }}
                        className={`${inputCls} ${isSameCustomer ? 'border-purple-300' : ''}`}>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.quantity} step="0.1"
                        onChange={e => setCell(i, 'quantity', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 3)}
                        placeholder="0.0" className={`${inputCls} ${filled ? 'font-semibold' : ''}`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.rate}
                        onChange={e => setCell(i, 'rate', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 4)}
                        placeholder="3500" step="50" className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-purple-700 text-xs">
                      {fmtCur(amt)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.pump_charge}
                        onChange={e => setCell(i, 'pump_charge', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 5)}
                        placeholder="0" className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-700 text-xs">
                      {fmtCur(total)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.advance}
                        onChange={e => setCell(i, 'advance', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 6)}
                        placeholder="0" className={inputCls} />
                    </td>
                    <td className={`px-2 py-1.5 text-right text-xs font-medium ${bal && bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {fmtCur(bal)}
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.payment_mode}
                        onChange={e => setCell(i, 'payment_mode', e.target.value)}
                        className={inputCls}>
                        <option>CASH</option>
                        <option>NY A/C</option>
                        <option>MKL A/C</option>
                        <option>KMK A/C</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={row.status}
                        onChange={e => setCell(i, 'status', e.target.value)}
                        className={inputCls}>
                        <option>CLOSED</option>
                        <option>OPEN</option>
                        <option>PENDING</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={() => duplicateCustomer(i)} title="Add another grade for same customer"
                          className="text-purple-500 hover:text-purple-700 text-sm font-bold">
                          +G
                        </button>
                        <button onClick={() => removeRow(i)}
                          className="text-slate-300 hover:text-red-500 text-lg leading-none">×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button onClick={addRow} className="text-sm text-purple-600 hover:underline">
            + Add row
          </button>
          <p className="text-xs text-slate-400">
            <span className="text-purple-600 font-medium">+G</span> = add another grade for same customer ·
            Tab → next cell · Enter → new row
          </p>
        </div>
      </div>
    </div>
  );
}
