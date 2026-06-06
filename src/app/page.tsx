'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import SalesTable from '@/components/SalesTable';
import AddSaleForm from '@/components/AddSaleForm';
import BulkEntry from '@/components/BulkEntry';
import Customers from '@/components/Customers';
import Outstanding from '@/components/Outstanding';
import Ledger from '@/components/Ledger';
import Stock from '@/components/Stock';
import RMCDashboard from '@/components/rmc/RMCDashboard';
import RMCSalesTable from '@/components/rmc/RMCSalesTable';
import RMCBulkEntry from '@/components/rmc/RMCBulkEntry';
import RMCOutstanding from '@/components/rmc/RMCOutstanding';
import RMCCustomers from '@/components/rmc/RMCCustomers';
import RMCCubeTests from '@/components/rmc/RMCCubeTests';
import AgeingReport from '@/components/AgeingReport';

type Module = 'blocks' | 'rmc';
type Tab = 'dashboard' | 'sales' | 'outstanding' | 'customers' | 'ledger' | 'bulk' | 'add' | 'stock' | 'ageing';
type RMCTab = 'dashboard' | 'sales' | 'outstanding' | 'customers' | 'bulk' | 'cube-tests' | 'ageing';

export default function Home() {
  const [module, setModule] = useState<Module>('blocks');
  const [tab, setTab] = useState<Tab>('dashboard');
  const [rmcTab, setRmcTab] = useState<RMCTab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();

  const refresh = () => setRefreshKey(k => k + 1);

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/login');
  };

  const blocksTabs: { id: Tab; label: string; color?: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sales', label: 'Sales Log' },
    { id: 'outstanding', label: 'Outstanding' },
    { id: 'customers', label: 'Customers' },
    { id: 'ledger', label: 'Ledger' },
    { id: 'stock', label: '📦 Stock', color: 'slate' },
    { id: 'ageing', label: 'Ageing' },
    { id: 'bulk', label: '⚡ Daily Entry', color: 'orange' },
    { id: 'add', label: '+ Single Sale', color: 'green' },
  ];

  const rmcTabs: { id: RMCTab; label: string; color?: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sales', label: 'Sales Log' },
    { id: 'outstanding', label: 'Outstanding' },
    { id: 'customers', label: 'Customers' },
    { id: 'cube-tests', label: '🧪 Cube Tests' },
    { id: 'ageing', label: 'Ageing' },
    { id: 'bulk', label: '⚡ Daily Entry', color: 'orange' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {module === 'blocks' ? 'BLOCKS SALES' : 'RMC SALES'}
                </h1>
                <p className="text-xs text-slate-500 -mt-0.5">Sales Manager</p>
              </div>
              {/* Module switcher */}
              <div className="flex gap-1 ml-4 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                <button
                  onClick={() => setModule('blocks')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    module === 'blocks' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Blocks
                </button>
                <button
                  onClick={() => setModule('rmc')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    module === 'rmc' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  RMC
                </button>
              </div>
            </div>
            <nav className="flex gap-1 flex-wrap items-center">
              {module === 'blocks' && blocksTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-blue-600 text-white'
                      : t.color === 'orange'
                      ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                      : t.color === 'green'
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : t.id === 'ledger'
                      ? 'text-violet-600 hover:bg-violet-50'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              {module === 'rmc' && rmcTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setRmcTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    rmcTab === t.id
                      ? 'bg-purple-600 text-white'
                      : t.color === 'orange'
                      ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="ml-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 border border-slate-200"
                title="Sign out"
              >
                Sign out
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Blocks module */}
        {module === 'blocks' && (
          <>
            {tab === 'dashboard'  && <Dashboard key={refreshKey} />}
            {tab === 'sales'      && <SalesTable key={refreshKey} onRefresh={refresh} />}
            {tab === 'outstanding'&& <Outstanding key={refreshKey} onRefresh={refresh} />}
            {tab === 'customers'  && <Customers key={refreshKey} />}
            {tab === 'ledger'     && <Ledger key={refreshKey} />}
            {tab === 'stock'      && <Stock key={refreshKey} />}
            {tab === 'ageing'     && <AgeingReport key={refreshKey} apiBase="/api" />}
            {tab === 'bulk'       && <BulkEntry onSaved={() => { refresh(); setTab('sales'); }} />}
            {tab === 'add'        && <AddSaleForm onSaved={() => { refresh(); setTab('sales'); }} />}
          </>
        )}

        {/* RMC module */}
        {module === 'rmc' && (
          <>
            {rmcTab === 'dashboard'   && <RMCDashboard key={refreshKey} />}
            {rmcTab === 'sales'       && <RMCSalesTable key={refreshKey} onRefresh={refresh} />}
            {rmcTab === 'outstanding' && <RMCOutstanding key={refreshKey} onRefresh={refresh} />}
            {rmcTab === 'customers'   && <RMCCustomers key={refreshKey} />}
            {rmcTab === 'cube-tests'  && <RMCCubeTests key={refreshKey} />}
            {rmcTab === 'ageing'      && <AgeingReport key={refreshKey} apiBase="/api/rmc" />}
            {rmcTab === 'bulk'        && <RMCBulkEntry onSaved={() => { refresh(); setRmcTab('sales'); }} />}
          </>
        )}
      </main>
    </div>
  );
}
