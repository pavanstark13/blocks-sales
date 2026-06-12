'use client';

import React, { useState } from 'react';
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
import RMCLedger from '@/components/rmc/RMCLedger';
import RMCCement from '@/components/rmc/RMCCement';
import RMCReport from '@/components/rmc/RMCReport';
import AgeingReport from '@/components/AgeingReport';

type Module = 'blocks' | 'rmc';
type Tab = 'dashboard' | 'sales' | 'outstanding' | 'customers' | 'ledger' | 'bulk' | 'add' | 'stock' | 'ageing';
type RMCTab = 'dashboard' | 'sales' | 'outstanding' | 'customers' | 'ledger' | 'bulk' | 'cube-tests' | 'ageing' | 'cement' | 'report';

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

  const blocksTabs: { id: Tab; label: string; icon?: React.ReactNode; color?: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sales', label: 'Sales Log' },
    { id: 'outstanding', label: 'Outstanding' },
    { id: 'customers', label: 'Customers' },
    { id: 'ledger', label: 'Ledger' },
    {
      id: 'stock', label: 'Stock', color: 'slate',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        </svg>
      ),
    },
    { id: 'ageing', label: 'Ageing' },
    {
      id: 'bulk', label: 'Daily Entry', color: 'orange',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: 'add', label: 'Single Sale', color: 'green',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
  ];

  const rmcTabs: { id: RMCTab; label: string; icon?: React.ReactNode; color?: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sales', label: 'Sales Log' },
    { id: 'outstanding', label: 'Outstanding' },
    { id: 'customers', label: 'Customers' },
    { id: 'ledger', label: 'Ledger' },
    {
      id: 'cube-tests', label: 'Cube Tests',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    { id: 'ageing', label: 'Ageing' },
    {
      id: 'report', label: 'Reports',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'cement', label: 'Cement',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        </svg>
      ),
    },
    {
      id: 'bulk', label: 'Daily Entry', color: 'orange',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 print:hidden shadow-sm">
        {/* Top bar: brand + module switcher + logout */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${module === 'blocks' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                {module === 'blocks' ? (
                  <svg className="w-4.5 h-4.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="9" height="9" rx="1.5" />
                    <rect x="13" y="2" width="9" height="9" rx="1.5" />
                    <rect x="2" y="13" width="9" height="9" rx="1.5" />
                    <rect x="13" y="13" width="9" height="9" rx="1.5" />
                  </svg>
                ) : (
                  <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                )}
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-tight">
                  {module === 'blocks' ? 'Blocks Sales' : 'RMC Sales'}
                </h1>
                <p className="text-[10px] text-slate-400 leading-tight">Sales Manager</p>
              </div>
              {/* Module switcher */}
              <div className="flex gap-0.5 ml-3 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                <button
                  onClick={() => setModule('blocks')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    module === 'blocks' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Blocks
                </button>
                <button
                  onClick={() => setModule('rmc')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    module === 'rmc' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  RMC
                </button>
              </div>
            </div>
            {/* Sign out */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-slate-200 transition-colors duration-150 cursor-pointer"
              title="Sign out"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        {/* Tab bar — scrollable */}
        <div className="border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex gap-0.5 overflow-x-auto scrollbar-hide py-1.5" aria-label="Tabs">
              {module === 'blocks' && blocksTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer flex-shrink-0 ${
                    tab === t.id
                      ? module === 'blocks'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-purple-600 text-white shadow-sm'
                      : t.color === 'orange'
                      ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                      : t.color === 'green'
                      ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      : t.id === 'ledger'
                      ? 'text-violet-600 hover:bg-violet-50'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
              {module === 'rmc' && rmcTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setRmcTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer flex-shrink-0 ${
                    rmcTab === t.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : t.color === 'orange'
                      ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                      : t.id === 'ledger'
                      ? 'text-violet-600 hover:bg-violet-50'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
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
            {rmcTab === 'ledger'      && <RMCLedger key={refreshKey} />}
            {rmcTab === 'cube-tests'  && <RMCCubeTests key={refreshKey} />}
            {rmcTab === 'ageing'      && <AgeingReport key={refreshKey} apiBase="/api/rmc" />}
            {rmcTab === 'report'      && <RMCReport key={refreshKey} />}
            {rmcTab === 'cement'      && <RMCCement key={refreshKey} />}
            {rmcTab === 'bulk'        && <RMCBulkEntry onSaved={() => { refresh(); setRmcTab('sales'); }} />}
          </>
        )}
      </main>
    </div>
  );
}
