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

const GRADES = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40'];
const PAYMENT_MODES = ['CASH', 'NY A/C', 'MKL A/C', 'KMK A/C', 'KSC A/C', 'ONLINE'];

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

function excelDateToString(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

function normaliseGrade(raw: string): string {
  if (!raw) return 'M20';
  const s = String(raw).trim().toUpperCase();
  if (GRADES.includes(s)) return s;
  // Handle "M 20" → "M20"
  const m = s.match(/^M\s*(\d+)$/);
  if (m) {
    const g = `M${m[1]}`;
    return GRADES.includes(g) ? g : g;
  }
  return s || 'M20';
}

// Fuzzy column header matcher
function detectCols(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const s = String(h ?? '').toLowerCase().replace(/[\s_\-\.]+/g, '');
    if (!map.date && /^date/.test(s)) map.date = i;
    if (!map.customer_name && /(customer|party|client|name)/.test(s)) map.customer_name = i;
    if (!map.site_address && /(site|address|location|village|place)/.test(s)) map.site_address = i;
    if (!map.grade && /^grade/.test(s)) map.grade = i;
    if (!map.quantity && /(qty|quantity|vol|cum|m3)/.test(s)) map.quantity = i;
    if (!map.rate && /^rate/.test(s)) map.rate = i;
    if (!map.pump_charge && /pump/.test(s)) map.pump_charge = i;
    if (!map.advance && /advanc/.test(s)) map.advance = i;
    if (!map.status && /status/.test(s)) map.status = i;
    if (!map.payment_mode && /(mode|payment)/.test(s)) map.payment_mode = i;
  });
  return map;
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

  // Excel upload state
  const [uploadMode, setUploadMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ rows: Row[]; dateOverride?: string; source: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const cached = rateCache.current[src.customer_name];
    if (cached && cached[nextGrade]) newRow.rate = String(cached[nextGrade]);
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

  // ── Excel parsing ────────────────────────────────────────────────────────────
  const parseExcel = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

      if (raw.length < 2) throw new Error('Sheet appears empty');

      // Find header row (first row with at least 4 non-empty cells)
      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, raw.length); i++) {
        if (raw[i].filter(Boolean).length >= 4) { headerIdx = i; break; }
      }
      const headers = (raw[headerIdx] as string[]).map(h => String(h ?? ''));
      const colMap = detectCols(headers);

      // Try to detect a date from the sheet/filename if no date column
      let sheetDate: string | undefined;
      if (colMap.date === undefined) {
        // Try filename: "2025-08-15.xlsx" or "Aug 15 2025.xlsx"
        const fnMatch = file.name.match(/(\d{4}[-\/]\d{2}[-\/]\d{2})/);
        if (fnMatch) sheetDate = fnMatch[1].replace(/\//g, '-');
      }

      const parsed: Row[] = [];
      for (let i = headerIdx + 1; i < raw.length; i++) {
        const cells = raw[i] as (string | number)[];
        if (cells.every(c => !c && c !== 0)) continue; // skip blank rows

        // Date
        let rowDate = sheetDate;
        if (colMap.date !== undefined) {
          const dv = cells[colMap.date];
          if (typeof dv === 'number' && dv > 40000) rowDate = excelDateToString(dv);
          else if (dv) rowDate = String(dv).trim();
        }

        const qty = parseFloat(String(cells[colMap.quantity ?? -1] ?? '')) || 0;
        if (qty <= 0) continue; // skip rows with no quantity

        const customer = colMap.customer_name !== undefined ? String(cells[colMap.customer_name] ?? '').trim() : '';
        const site = colMap.site_address !== undefined ? String(cells[colMap.site_address] ?? '').trim() : '';
        const gradeRaw = colMap.grade !== undefined ? String(cells[colMap.grade] ?? '').trim() : 'M20';
        const rate = parseFloat(String(cells[colMap.rate ?? -1] ?? '')) || 0;
        const pump = parseFloat(String(cells[colMap.pump_charge ?? -1] ?? '')) || 0;
        const adv = parseFloat(String(cells[colMap.advance ?? -1] ?? '')) || 0;
        const statusRaw = colMap.status !== undefined ? String(cells[colMap.status] ?? '').trim().toUpperCase() : '';
        const modeRaw = colMap.payment_mode !== undefined ? String(cells[colMap.payment_mode] ?? '').trim().toUpperCase() : 'CASH';

        parsed.push({
          customer_name: customer,
          site_address: site,
          grade: normaliseGrade(gradeRaw),
          quantity: String(qty),
          rate: rate > 0 ? String(rate) : '',
          pump_charge: String(pump),
          advance: String(adv),
          payment_mode: PAYMENT_MODES.includes(modeRaw) ? modeRaw : 'CASH',
          status: ['OPEN', 'PENDING', 'CLOSED'].includes(statusRaw) ? statusRaw : 'CLOSED',
        });

        // Tag the date if we found one per row (store in a side channel)
        if (rowDate && !sheetDate) sheetDate = rowDate;
      }

      if (!parsed.length) throw new Error('No valid rows found (need Quantity > 0)');

      setUploadPreview({ rows: parsed, dateOverride: sheetDate, source: file.name });
    } catch (err) {
      alert(`Could not parse Excel: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcel(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseExcel(file);
  };

  const confirmUpload = () => {
    if (!uploadPreview) return;
    if (uploadPreview.dateOverride) setDate(uploadPreview.dateOverride);
    setRows(uploadPreview.rows.length ? uploadPreview.rows : [emptyRow()]);
    setUploadPreview(null);
    setUploadMode(false);
  };

  // ── Save ────────────────────────────────────────────────────────────────────
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
      {/* ── Upload Preview Modal ────────────────────────────────────────────── */}
      {uploadPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">Preview Import</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {uploadPreview.source} · {uploadPreview.rows.length} rows detected
                  {uploadPreview.dateOverride && ` · Date: ${uploadPreview.dateOverride}`}
                </p>
              </div>
              <button onClick={() => setUploadPreview(null)}
                className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer">×</button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-500">
                    <th className="px-2 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium">Customer</th>
                    <th className="px-2 py-1.5 font-medium">Site</th>
                    <th className="px-2 py-1.5 font-medium">Grade</th>
                    <th className="px-2 py-1.5 font-medium text-right">Qty m³</th>
                    <th className="px-2 py-1.5 font-medium text-right">Rate</th>
                    <th className="px-2 py-1.5 font-medium text-right">Amount</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {uploadPreview.rows.map((r, i) => {
                    const amt = calcAmount(r);
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-2 py-1.5 text-slate-400">{i+1}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-700">{r.customer_name || <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-1.5 text-slate-500">{r.site_address || '—'}</td>
                        <td className="px-2 py-1.5">
                          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{r.grade}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold">{r.quantity}</td>
                        <td className="px-2 py-1.5 text-right text-slate-500">{r.rate || '—'}</td>
                        <td className="px-2 py-1.5 text-right text-purple-600 font-medium">{amt ? fmtCur(amt) : '—'}</td>
                        <td className="px-2 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            r.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                            r.status === 'PENDING' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>{r.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex justify-between items-center">
              <div className="text-sm text-slate-600">
                Total: <span className="font-semibold text-purple-600">
                  {uploadPreview.rows.reduce((s,r) => s + (parseFloat(r.quantity)||0), 0).toFixed(1)} m³
                </span>
                {' · '}
                <span className="font-semibold text-slate-700">
                  {fmtCur(uploadPreview.rows.reduce((s,r) => s + (calcTotal(r)||0), 0))}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setUploadPreview(null)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button onClick={confirmUpload}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium cursor-pointer">
                  Load {uploadPreview.rows.length} rows →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
        <div className="flex gap-2 flex-wrap">
          {/* Upload Excel button */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50 cursor-pointer font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {uploading ? 'Parsing…' : 'Upload Excel'}
            </button>
          </div>
          <button onClick={addRow}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            + Add Row
          </button>
          <button onClick={handleSave} disabled={saving || filledRows.length === 0}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium cursor-pointer">
            {saving ? `Saving ${filledRows.length}…` : `Save All (${filledRows.length})`}
          </button>
        </div>
      </div>

      {/* ── Upload drag zone (collapsible) ──────────────────────────────────── */}
      {uploadMode && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-slate-50'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-slate-600 font-medium">Drop your Excel file here or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">Supports .xlsx, .xls, .csv · Auto-detects columns</p>
          <p className="text-xs text-slate-400 mt-0.5">Expected columns: Customer, Grade, Qty, Rate (optional: Site, Pump, Advance, Status)</p>
        </div>
      )}

      <div className="flex justify-end -mt-2">
        <button
          onClick={() => setUploadMode(v => !v)}
          className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          {uploadMode ? '▲ Hide drop zone' : '▼ Show drag-and-drop zone'}
        </button>
      </div>

      {result && (
        <div className={`rounded-xl p-4 text-sm font-medium ${result.errors === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {result.saved > 0 && `✓ ${result.saved} entries saved. `}
          {result.errors > 0 && `⚠ ${result.errors} failed.`}
        </div>
      )}

      {/* ── Spreadsheet ─────────────────────────────────────────────────────── */}
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
                      {!GRADES.includes(row.grade as typeof GRADES[number]) && row.grade !== '' ? (
                        <div className="flex gap-1">
                          <input value={row.grade} onChange={e => setCell(i, 'grade', e.target.value)}
                            placeholder="e.g. M45" className={`${inputCls} w-20`} />
                          <button onClick={() => setCell(i, 'grade', 'M20')}
                            className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">↩</button>
                        </div>
                      ) : (
                        <select value={row.grade} onChange={e => {
                          const newGrade = e.target.value;
                          if (newGrade === '__custom__') { setCell(i, 'grade', ''); return; }
                          setCell(i, 'grade', newGrade);
                          const cached = rateCache.current[row.customer_name];
                          if (cached && cached[newGrade]) {
                            setRows(prev => prev.map((r, idx) => idx === i ? { ...r, grade: newGrade, rate: String(cached[newGrade]) } : r));
                          }
                        }} className={`${inputCls} ${isSameCustomer ? 'border-purple-300' : ''}`}>
                          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                          <option value="__custom__">Other (type)...</option>
                        </select>
                      )}
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
                    <td className="px-2 py-1.5 text-right font-medium text-purple-700 text-xs">{fmtCur(amt)}</td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.pump_charge}
                        onChange={e => setCell(i, 'pump_charge', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 5)}
                        placeholder="0" className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-700 text-xs">{fmtCur(total)}</td>
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
                        {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
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
                          className="text-purple-500 hover:text-purple-700 text-sm font-bold cursor-pointer">
                          +G
                        </button>
                        <button onClick={() => removeRow(i)}
                          className="text-slate-300 hover:text-red-500 text-lg leading-none cursor-pointer">×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button onClick={addRow} className="text-sm text-purple-600 hover:underline cursor-pointer">
            + Add row
          </button>
          <p className="text-xs text-slate-400">
            <span className="text-emerald-600 font-medium">Upload Excel</span> to auto-fill ·{' '}
            <span className="text-purple-600 font-medium">+G</span> = add grade · Tab/Enter = next row
          </p>
        </div>
      </div>
    </div>
  );
}
