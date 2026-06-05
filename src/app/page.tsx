'use client';

import { useState } from 'react';
import Dashboard from '@/components/Dashboard';
import SalesTable from '@/components/SalesTable';
import AddSaleForm from '@/components/AddSaleForm';
import Customers from '@/components/Customers';
import Outstanding from '@/components/Outstanding';

type Tab = 'dashboard' | 'sales' | 'outstanding' | 'customers' | 'add';

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sales', label: 'Sales Log' },
    { id: 'outstanding', label: 'Outstanding' },
    { id: 'customers', label: 'Customers' },
    { id: 'add', label: '+ New Sale' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-lg font-bold text-slate-900">BLOCKS SALES</h1>
              <p className="text-xs text-slate-500 -mt-0.5">Sales Manager</p>
            </div>
            <nav className="flex gap-1 flex-wrap">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-blue-600 text-white'
                      : t.id === 'add'
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'dashboard' && <Dashboard key={refreshKey} />}
        {tab === 'sales' && <SalesTable key={refreshKey} onRefresh={refresh} />}
        {tab === 'outstanding' && <Outstanding key={refreshKey} onRefresh={refresh} />}
        {tab === 'customers' && <Customers key={refreshKey} />}
        {tab === 'add' && <AddSaleForm onSaved={() => { refresh(); setTab('sales'); }} />}
      </main>
    </div>
  );
}
