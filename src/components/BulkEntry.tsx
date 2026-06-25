'use client';

import { useState, useRef, useCallback } from 'react';

interface Row {
  customer_name: string;
  address: string;
  phone: string;
  site_name: string;
  qty_4inch: string;
  qty_6inch: string;
  qty_8inch: string;
  rate: string;
  advance: string;
  payment_mode: string;
  status: string;
}

const PAYMENT_MODES = ['CASH', 'NY A/C', 'MKL A/C', 'KMK A/C'];

const emptyRow = (): Row => ({
  customer_name: '', address: '', phone: '', site_name: '',
  qty_4inch: '', qty_6inch: '', qty_8inch: '',
  rate: '', advance: '0',
  payment_mode: 'CASH', status: 'CLOSED',
});

function calcTotal(r: Row) {
  return (parseInt(r.qty_4inch) || 0) + (parseInt(r.qty_6inch) || 0) + (parseInt(r.qty_8inch) || 0);
}

function calcAmount(r: Row) {
  const qty = calcTotal(r);
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

function excelDateToString(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

function detectCols(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const s = String(h ?? '').toLowerCase().replace(/[\s_\-\.]+/g, '');
    if (!map.date && /^date/.test(s)) map.date = i;
    if (!map.customer_name && /(customer|party|client|name)/.test(s)) map.customer_name = i;
    if (!map.address && /(address|village|area|location|place)/.test(s)) map.address = i;
    if (!map.phone && /(phone|mobile|contact|number)/.test(s)) map.phone = i;
    if (!map.site_name && /(site|project)/.test(s)) map.site_name = i;
    if (!map.qty_4inch && /4.*(qty|nos|quantity|block)/i.test(s)) map.qty_4inch = i;
    if (!map.qty_6inch && /6.*(qty|nos|quantity|block)/i.test(s)) map.qty_6inch = i;
    if (!map.qty_8inch && /8.*(qty|nos|quantity|block)/i.test(s)) map.qty_8inch = i;
    if (!map.rate && /^rate/.test(s)) map.rate = i;
    if (!map.advance && /advanc/.test(s)) map.advance = i;
    if (!map.status && /status/.test(s)) map.status = i;
    if (!map.payment_mode && /(mode|payment)/.test(s)) map.payment_mode = i;
  });
  return map;
}

const COLS = ['customer_name','address','phone','site_name','qty_4inch','qty_6inch','qty_8inch','rate','advance','payment_mode','status'];

export default function BulkEntry({ onSaved }: { onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; errors: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const rateCache = useRef<Record<string, number>>({});

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
      const res = await fetch(
        `/api/customer-rates?customer=${encodeURIComponent(name)}&date=${encodeURIComponent(date)}`
      );
      const data = await res.json();
      const fetched = data.rates as Record<number, number>;
      // Use the rate for the most common size as default
      const defaultRate = fetched[6] || fetched[4] || fetched[8] || 0;
      if (defaultRate) rateCache.current[name] = defaultRate;
      setRows(prev => prev.map((r, idx) => {
        if (idx !== i || r.rate) return r;
        const savedRate = defaultRate;
        if (savedRate) return { ...r, rate: String(savedRate) };
        return r;
      }));
    } catch { /* ignore */ }
  }, [date]);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, emptyRow()]);
  }, []);

  const removeRow = (i: number) => {
    setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  };

  const duplicateCustomer = (i: number) => {
    const src = rows[i];
    const newRow: Row = {
      customer_name: src.customer_name,
      address: src.address,
      phone: src.phone,
      payment_mode: src.payment_mode,
      status: src.status,
      site_name: '',
      qty_4inch: '',
      qty_6inch: '',
      qty_8inch: '',
      rate: src.rate,
      advance: '0',
    };
    setRows(prev => {
      const next = [...prev];
      next.splice(i + 1, 0, newRow);
      return next;
    });
    setTimeout(() => {
      const trs = tableRef.current?.querySelectorAll('tr[data-row]');
      const newTr = trs?.[i + 1];
      const siteInput = newTr?.querySelectorAll('input')[3] as HTMLElement;
      siteInput?.focus();
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

      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, raw.length); i++) {
        if (raw[i].filter(Boolean).length >= 4) { headerIdx = i; break; }
      }
      const headers = (raw[headerIdx] as string[]).map(h => String(h ?? ''));
      const colMap = detectCols(headers);

      let sheetDate: string | undefined;
      if (colMap.date === undefined) {
        const fnMatch = file.name.match(/(\d{4}[-\/]\d{2}[-\/]\d{2})/);
        if (fnMatch) sheetDate = fnMatch[1].replace(/\//g, '-');
      }

      const parsed: Row[] = [];
      for (let i = headerIdx + 1; i < raw.length; i++) {
        const cells = raw[i] as (string | number)[];
        if (cells.every(c => !c && c !== 0)) continue;

        let rowDate = sheetDate;
        if (colMap.date !== undefined) {
          const dv = cells[colMap.date];
          if (typeof dv === 'number' && dv > 40000) rowDate = excelDateToString(dv);
          else if (dv) rowDate = String(dv).trim();
        }

        const q4 = parseInt(String(cells[colMap.qty_4inch ?? -1] ?? '')) || 0;
        const q6 = parseInt(String(cells[colMap.qty_6inch ?? -1] ?? '')) || 0;
        const q8 = parseInt(String(cells[colMap.qty_8inch ?? -1] ?? '')) || 0;
        if (q4 + q6 + q8 <= 0) continue;

        const customer = colMap.customer_name !== undefined ? String(cells[colMap.customer_name] ?? '').trim() : '';
        const address = colMap.address !== undefined ? String(cells[colMap.address] ?? '').trim() : '';
        const phone = colMap.phone !== undefined ? String(cells[colMap.phone] ?? '').trim() : '';
        const site = colMap.site_name !== undefined ? String(cells[colMap.site_name] ?? '').trim() : '';
        const rate = parseFloat(String(cells[colMap.rate ?? -1] ?? '')) || 0;
        const adv = parseFloat(String(cells[colMap.advance ?? -1] ?? '')) || 0;
        const statusRaw = colMap.status !== undefined ? String(cells[colMap.status] ?? '').trim().toUpperCase() : '';
        const modeRaw = colMap.payment_mode !== undefined ? String(cells[colMap.payment_mode] ?? '').trim().toUpperCase() : 'CASH';

        parsed.push({
          customer_name: customer,
          address,
          phone,
          site_name: site,
          qty_4inch: q4 > 0 ? String(q4) : '',
          qty_6inch: q6 > 0 ? String(q6) : '',
          qty_8inch: q8 > 0 ? String(q8) : '',
          rate: rate > 0 ? String(rate) : '',
          advance: String(adv),
          payment_mode: PAYMENT_MODES.includes(modeRaw) ? modeRaw : 'CASH',
          status: ['OPEN', 'PENDING', 'CLOSED'].includes(statusRaw) ? statusRaw : 'CLOSED',
        });

        if (rowDate && !sheetDate) sheetDate = rowDate;
      }

      if (!parsed.length) throw new Error('No valid rows found (need at least one of 4"/6"/8" qty > 0)');

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

  const totalAmount = rows.reduce((s, r) => s + (calcAmount(r) || 0), 0);
  const totalQty = rows.reduce((s, r) => s + calcTotal(r), 0);
  const total4 = rows.reduce((s, r) => s + (parseInt(r.qty_4inch) || 0), 0);
  const total6 = rows.reduce((s, r) => s + (parseInt(r.qty_6inch) || 0), 0);
  const total8 = rows.reduce((s, r) => s + (parseInt(r.qty_8inch) || 0), 0);
  const filledRows = rows.filter(r => calcTotal(r) > 0);

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
            date,
            customer_name: row.customer_name || null,
            address: row.address || null,
            phone: row.phone || null,
            site_name: row.site_name || null,
            qty_4inch: parseInt(row.qty_4inch) || 0,
            qty_6inch: parseInt(row.qty_6inch) || 0,
            qty_8inch: parseInt(row.qty_8inch) || 0,
            rate: parseFloat(row.rate) || null,
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

  const inputCls = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="space-y-4">
      {/* Upload Preview Modal */}
      {uploadPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
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
                    <th className="px-2 py-1.5 font-medium text-right">4&quot;</th>
                    <th className="px-2 py-1.5 font-medium text-right">6&quot;</th>
                    <th className="px-2 py-1.5 font-medium text-right">8&quot;</th>
                    <th className="px-2 py-1.5 font-medium text-right">Total</th>
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
                        <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-700">{r.customer_name || <span className="text-slate-300">—</span>}</td>
                        <td className="px-2 py-1.5 text-slate-500">{r.site_name || '—'}</td>
                        <td className="px-2 py-1.5 text-right">{r.qty_4inch || '—'}</td>
                        <td className="px-2 py-1.5 text-right">{r.qty_6inch || '—'}</td>
                        <td className="px-2 py-1.5 text-right">{r.qty_8inch || '—'}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{calcTotal(r)}</td>
                        <td className="px-2 py-1.5 text-right text-slate-500">{r.rate || '—'}</td>
                        <td className="px-2 py-1.5 text-right text-blue-600 font-medium">{amt ? fmtCur(amt) : '—'}</td>
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
                Total: <span className="font-semibold text-blue-600">
                  {uploadPreview.rows.reduce((s, r) => s + calcTotal(r), 0).toLocaleString('en-IN')} blocks
                </span>
                {' · '}
                <span className="font-semibold text-slate-700">
                  {fmtCur(uploadPreview.rows.reduce((s, r) => s + (calcAmount(r) || 0), 0))}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setUploadPreview(null)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button onClick={confirmUpload}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium cursor-pointer">
                  Load {uploadPreview.rows.length} rows →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date for all entries</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex-1 text-sm text-slate-500 space-y-0.5">
          <div>
            <span className="font-semibold text-slate-700">{filledRows.length}</span> rows ·{' '}
            <span className="font-semibold text-slate-700">{totalQty.toLocaleString('en-IN')}</span> total blocks ·{' '}
            <span className="font-semibold text-blue-600">{fmtCur(totalAmount)}</span>
          </div>
          {totalQty > 0 && (
            <div className="text-xs">
              {total4 > 0 && <span className="mr-2 text-indigo-600">4&quot;: {total4.toLocaleString('en-IN')}</span>}
              {total6 > 0 && <span className="mr-2 text-blue-600">6&quot;: {total6.toLocaleString('en-IN')}</span>}
              {total8 > 0 && <span className="mr-2 text-violet-600">8&quot;: {total8.toLocaleString('en-IN')}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
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
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium cursor-pointer">
            {saving ? `Saving ${filledRows.length} rows...` : `Save All (${filledRows.length})`}
          </button>
        </div>
      </div>

      {/* Drag-drop zone */}
      {uploadMode && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-slate-600 font-medium">Drop your Excel file here or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">Supports .xlsx, .xls, .csv · Auto-detects columns</p>
          <p className="text-xs text-slate-400 mt-0.5">Expected columns: Customer, Site, 4&quot; Qty, 6&quot; Qty, 8&quot; Qty, Rate</p>
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

      {/* Spreadsheet table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-500 font-semibold">
                <th className="px-3 py-2 w-6">#</th>
                <th className="px-2 py-2 min-w-36">Customer Name</th>
                <th className="px-2 py-2 min-w-24">Address</th>
                <th className="px-2 py-2 min-w-20">Phone</th>
                <th className="px-2 py-2 min-w-28">Site / Project</th>
                <th className="px-2 py-2 w-16 text-center text-indigo-600">4&quot;</th>
                <th className="px-2 py-2 w-16 text-center text-blue-600">6&quot;</th>
                <th className="px-2 py-2 w-16 text-center text-violet-600">8&quot;</th>
                <th className="px-2 py-2 w-16 text-right">Total</th>
                <th className="px-2 py-2 w-20">Rate</th>
                <th className="px-2 py-2 w-24">Amount</th>
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
                const bal = calcBalance(row);
                const total = calcTotal(row);
                const filled = total > 0;
                const isSameCustomer = i > 0 &&
                  row.customer_name &&
                  row.customer_name === rows[i - 1].customer_name;

                return (
                  <tr key={i} data-row={i}
                    className={`${isSameCustomer ? 'bg-orange-50/40 border-l-2 border-orange-300' : filled ? 'bg-blue-50/20' : ''} hover:bg-slate-50`}>
                    <td className="px-3 py-1.5 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      {isSameCustomer ? (
                        <span className="text-xs text-orange-600 font-medium truncate max-w-28 block" title={row.customer_name}>
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
                        <input value={row.address} onChange={e => setCell(i, 'address', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, i, 1)}
                          placeholder="Village/area" className={inputCls} />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {isSameCustomer ? (
                        <span className="text-xs text-slate-400 italic">same</span>
                      ) : (
                        <input value={row.phone} onChange={e => setCell(i, 'phone', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, i, 2)}
                          placeholder="Phone" className={inputCls} />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.site_name}
                        onChange={e => setCell(i, 'site_name', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 3)}
                        placeholder="Site name (optional)" className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.qty_4inch}
                        onChange={e => setCell(i, 'qty_4inch', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 4)}
                        placeholder="0" className={`${inputCls} text-center text-indigo-700`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.qty_6inch}
                        onChange={e => setCell(i, 'qty_6inch', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 5)}
                        placeholder="0" className={`${inputCls} text-center text-blue-700`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.qty_8inch}
                        onChange={e => setCell(i, 'qty_8inch', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 6)}
                        placeholder="0" className={`${inputCls} text-center text-violet-700`} />
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-bold text-slate-700">
                      {total > 0 ? total.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.rate}
                        onChange={e => setCell(i, 'rate', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 7)}
                        placeholder="42" step="0.5" className={inputCls} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-blue-700 text-xs">
                      {fmtCur(amt)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.advance}
                        onChange={e => setCell(i, 'advance', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, i, 9)}
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
                        <button onClick={() => duplicateCustomer(i)} title="Add another site for same customer"
                          className="text-orange-500 hover:text-orange-700 text-xs font-bold cursor-pointer px-1">
                          +Site
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
          <button onClick={addRow} className="text-sm text-blue-600 hover:underline cursor-pointer">
            + Add row
          </button>
          <p className="text-xs text-slate-400">
            Enter qty per size · <span className="text-orange-600 font-medium">+Site</span> = same customer, different site · Tab/Enter = next row
          </p>
        </div>
      </div>
    </div>
  );
}
