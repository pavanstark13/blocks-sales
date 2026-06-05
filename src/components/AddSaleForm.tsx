'use client';

import { useState } from 'react';

interface Props {
  onSaved: () => void;
}

export default function AddSaleForm({ onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today,
    customer_name: '',
    address: '',
    phone: '',
    size: '6',
    quantity: '',
    rate: '',
    advance: '0',
    status: 'CLOSED',
    payment_mode: 'CASH',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const amount = form.rate && form.quantity
    ? Math.round(Number(form.rate) * Number(form.quantity) * 100) / 100
    : null;
  const balance = amount != null ? Math.max(0, amount - Number(form.advance || 0)) : null;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.size || !form.quantity) {
      setError('Date, size, and quantity are required.');
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, size: Number(form.size), quantity: Number(form.quantity), rate: form.rate ? Number(form.rate) : null, advance: Number(form.advance) }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      const d = await res.json();
      setError(d.error || 'Failed to save');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-base font-semibold mb-5">New Sale Entry</h2>
        {error && <p className="text-sm text-red-600 mb-4 p-3 bg-red-50 rounded-lg">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={set('date')} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Customer Name</label>
              <input type="text" value={form.customer_name} onChange={set('customer_name')} placeholder="e.g. Ramu Basaralu"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
              <input type="text" value={form.address} onChange={set('address')} placeholder="Village / area"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="10-digit number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Block Size (inch) *</label>
              <select value={form.size} onChange={set('size')} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="4">4&quot;</option>
                <option value="6">6&quot;</option>
                <option value="8">8&quot;</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Quantity *</label>
              <input type="number" value={form.quantity} onChange={set('quantity')} placeholder="e.g. 644" min="1" required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rate per Block (₹)</label>
              <input type="number" value={form.rate} onChange={set('rate')} placeholder="e.g. 42" step="0.5"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Advance Received (₹)</label>
              <input type="number" value={form.advance} onChange={set('advance')} placeholder="0" min="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
              <select value={form.payment_mode} onChange={set('payment_mode')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>CASH</option>
                <option>NY A/C</option>
                <option>MKL A/C</option>
                <option>KMK A/C</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={set('status')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>CLOSED</option>
                <option>OPEN</option>
                <option>PENDING</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Any additional notes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Live calculation preview */}
          {amount != null && (
            <div className="bg-blue-50 rounded-xl p-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-blue-500">Total Amount</p>
                <p className="text-lg font-bold text-blue-700">₹{amount.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-blue-500">Advance</p>
                <p className="text-lg font-bold text-emerald-700">₹{Number(form.advance || 0).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-blue-500">Balance Due</p>
                <p className={`text-lg font-bold ${balance && balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  ₹{(balance ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl py-3 text-sm transition-colors disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Sale Entry'}
          </button>
        </form>
      </div>
    </div>
  );
}
