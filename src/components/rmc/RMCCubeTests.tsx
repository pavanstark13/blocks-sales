'use client';

import { useState, useEffect, useCallback } from 'react';

interface CubeTest {
  id: number;
  sale_id: number | null;
  date: string;
  customer_name: string | null;
  site_address: string | null;
  grade: string;
  batch_date: string | null;
  quantity: number | null;
  sample_count: number;
  result_7day: number | null;
  result_28day: number | null;
  required_strength: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const GRADES = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40'];

const GRADE_STRENGTH: Record<string, number> = {
  M10: 10, M15: 15, M20: 20, M25: 25, M30: 30, M35: 35, M40: 40,
};

function getRequiredStrength(grade: string): number {
  const num = parseInt(grade.replace('M', ''), 10);
  return GRADE_STRENGTH[grade] ?? (isNaN(num) ? 20 : num);
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PASS: 'bg-emerald-100 text-emerald-700',
  FAIL: 'bg-red-100 text-red-700',
};

const today = new Date().toISOString().split('T')[0];

export default function RMCCubeTests() {
  const [tests, setTests] = useState<CubeTest[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Add test form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    date: today,
    customer_name: '',
    site_address: '',
    grade: 'M20',
    batch_date: '',
    quantity: '',
    sample_count: '3',
  });
  const [addSaving, setAddSaving] = useState(false);

  // Enter results form
  const [resultTest, setResultTest] = useState<CubeTest | null>(null);
  const [resultForm, setResultForm] = useState({ result_7day: '', result_28day: '' });
  const [resultSaving, setResultSaving] = useState(false);

  const fetchTests = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filterGrade) p.set('grade', filterGrade);
    if (filterStatus) p.set('status', filterStatus);
    if (filterDateFrom) p.set('date_from', filterDateFrom);
    if (filterDateTo) p.set('date_to', filterDateTo);
    try {
      const res = await fetch('/api/rmc/cube-tests?' + p.toString());
      setTests(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filterGrade, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const submitAdd = async () => {
    if (!addForm.date || !addForm.grade) return;
    setAddSaving(true);
    const reqStrength = getRequiredStrength(addForm.grade);
    await fetch('/api/rmc/cube-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: addForm.date,
        customer_name: addForm.customer_name || null,
        site_address: addForm.site_address || null,
        grade: addForm.grade,
        batch_date: addForm.batch_date || null,
        quantity: addForm.quantity ? parseFloat(addForm.quantity) : null,
        sample_count: parseInt(addForm.sample_count) || 3,
        required_strength: reqStrength,
        status: 'PENDING',
      }),
    });
    setAddSaving(false);
    setShowAdd(false);
    setAddForm({ date: today, customer_name: '', site_address: '', grade: 'M20', batch_date: '', quantity: '', sample_count: '3' });
    fetchTests();
  };

  const openResults = (test: CubeTest) => {
    setResultTest(test);
    setResultForm({ result_7day: test.result_7day != null ? String(test.result_7day) : '', result_28day: test.result_28day != null ? String(test.result_28day) : '' });
  };

  const submitResults = async () => {
    if (!resultTest) return;
    setResultSaving(true);
    const r7 = resultForm.result_7day ? parseFloat(resultForm.result_7day) : null;
    const r28 = resultForm.result_28day ? parseFloat(resultForm.result_28day) : null;
    const reqStr = resultTest.required_strength ?? getRequiredStrength(resultTest.grade);
    let status = resultTest.status;
    if (r28 != null) {
      status = r28 >= reqStr ? 'PASS' : 'FAIL';
    }

    await fetch('/api/rmc/cube-tests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resultTest.id, result_7day: r7, result_28day: r28, status }),
    });
    setResultSaving(false);
    setResultTest(null);
    fetchTests();
  };

  const deleteTest = async (id: number) => {
    if (!confirm('Delete this cube test record?')) return;
    await fetch(`/api/rmc/cube-tests?id=${id}`, { method: 'DELETE' });
    fetchTests();
  };

  const exportCSV = () => {
    const headers = ['ID', 'Date', 'Customer', 'Site', 'Grade', 'Batch Date', 'Qty(m³)', 'Samples', '7-Day', '28-Day', 'Required', 'Status', 'Notes'];
    const rows = tests.map(t => [
      t.id, t.date, t.customer_name || '', t.site_address || '', t.grade,
      t.batch_date || '', t.quantity ?? '', t.sample_count,
      t.result_7day ?? '', t.result_28day ?? '', t.required_strength ?? '',
      t.status, t.notes || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cube-tests-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Grade</label>
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className={inputCls}>
            <option value="">All Grades</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
            <option value="">All</option>
            <option>PENDING</option>
            <option>PASS</option>
            <option>FAIL</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={inputCls} />
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
        >
          + Add Test
        </button>
        <button onClick={exportCSV} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          Export CSV
        </button>
        <span className="text-xs text-slate-500 self-center">{tests.length} records</span>
      </div>

      {/* Add Test Form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Add Cube Test Record</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
              <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Grade *</label>
              <select value={addForm.grade} onChange={e => setAddForm(f => ({ ...f, grade: e.target.value }))} className={`w-full ${inputCls}`}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
              <input type="text" value={addForm.customer_name} onChange={e => setAddForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Customer name" className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Site Address</label>
              <input type="text" value={addForm.site_address} onChange={e => setAddForm(f => ({ ...f, site_address: e.target.value }))} placeholder="Site" className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Batch Date</label>
              <input type="date" value={addForm.batch_date} onChange={e => setAddForm(f => ({ ...f, batch_date: e.target.value }))} className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Quantity (m³)</label>
              <input type="number" step="0.1" value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0.0" className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Sample Count</label>
              <input type="number" min="1" value={addForm.sample_count} onChange={e => setAddForm(f => ({ ...f, sample_count: e.target.value }))} className={`w-full ${inputCls}`} />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-slate-500">
                Required strength: <span className="font-semibold text-purple-600">{getRequiredStrength(addForm.grade)} MPa</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={submitAdd} disabled={addSaving || !addForm.date || !addForm.grade}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {addSaving ? 'Saving...' : 'Save Test'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-500 font-semibold">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Batch Date</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Samples</th>
                <th className="px-3 py-2 text-right">7-Day</th>
                <th className="px-3 py-2 text-right">28-Day</th>
                <th className="px-3 py-2 text-right">Required</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={12} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : tests.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-8 text-slate-400">No cube test records found</td></tr>
              ) : tests.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{t.date}</td>
                  <td className="px-3 py-2 text-slate-700 max-w-32 truncate">{t.customer_name || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 max-w-28 truncate">{t.site_address || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{t.grade}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{t.batch_date || '—'}</td>
                  <td className="px-3 py-2 text-right text-xs">{t.quantity != null ? Number(t.quantity).toFixed(1) : '—'}</td>
                  <td className="px-3 py-2 text-right text-xs">{t.sample_count}</td>
                  <td className="px-3 py-2 text-right text-xs">{t.result_7day != null ? `${t.result_7day} MPa` : '—'}</td>
                  <td className={`px-3 py-2 text-right text-xs font-semibold ${
                    t.result_28day != null && t.required_strength != null
                      ? t.result_28day >= t.required_strength ? 'text-emerald-600' : 'text-red-600'
                      : 'text-slate-500'
                  }`}>
                    {t.result_28day != null ? `${t.result_28day} MPa` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-500">
                    {t.required_strength != null ? `${t.required_strength} MPa` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[t.status] || 'bg-slate-100 text-slate-600'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 print:hidden">
                    <div className="flex gap-2">
                      <button onClick={() => openResults(t)} className="text-xs text-purple-600 hover:underline">
                        {t.result_28day != null ? 'Edit Results' : 'Enter Results'}
                      </button>
                      <button onClick={() => deleteTest(t.id)} className="text-xs text-rose-400 hover:text-rose-600">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enter Results Modal */}
      {resultTest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-1">Enter Test Results</h3>
            <p className="text-xs text-slate-500 mb-4">
              {resultTest.grade} · {resultTest.customer_name || 'No customer'} · {resultTest.date}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">7-Day Result (MPa)</label>
                <input type="number" step="0.1" value={resultForm.result_7day}
                  onChange={e => setResultForm(f => ({ ...f, result_7day: e.target.value }))}
                  placeholder="e.g. 18.5"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">28-Day Result (MPa)</label>
                <input type="number" step="0.1" value={resultForm.result_28day}
                  onChange={e => setResultForm(f => ({ ...f, result_28day: e.target.value }))}
                  placeholder="e.g. 28.0"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <p className="text-xs text-slate-500">
                Required strength: <span className="font-semibold">{resultTest.required_strength ?? getRequiredStrength(resultTest.grade)} MPa</span>
                {resultForm.result_28day && (
                  <span className={`ml-2 font-semibold ${parseFloat(resultForm.result_28day) >= (resultTest.required_strength ?? getRequiredStrength(resultTest.grade)) ? 'text-emerald-600' : 'text-red-600'}`}>
                    → {parseFloat(resultForm.result_28day) >= (resultTest.required_strength ?? getRequiredStrength(resultTest.grade)) ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={submitResults} disabled={resultSaving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                {resultSaving ? 'Saving...' : 'Save Results'}
              </button>
              <button onClick={() => setResultTest(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
