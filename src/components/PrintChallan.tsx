'use client';

import { useEffect } from 'react';

interface BlocksSale {
  module: 'blocks';
  id: number;
  date: string;
  customer_name?: string | null;
  address?: string | null;
  phone?: string | null;
  size: number;
  quantity: number;
  rate?: number | null;
  amount?: number | null;
  advance?: number | null;
  balance?: number | null;
  payment_mode?: string | null;
  notes?: string | null;
}

interface RMCSale {
  module: 'rmc';
  id: number;
  date: string;
  customer_name?: string | null;
  site_address?: string | null;
  phone?: string | null;
  grade: string;
  quantity: number;
  rate?: number | null;
  amount?: number | null;
  pump_charge?: number | null;
  total_amount?: number | null;
  advance?: number | null;
  balance?: number | null;
  payment_mode?: string | null;
  notes?: string | null;
}

type ChallanSale = BlocksSale | RMCSale;

interface Props {
  sale: ChallanSale;
  onClose: () => void;
}

function fmtCur(n: number | null | undefined) {
  if (n == null || n === 0) return '₹0';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-IN');
}

export default function PrintChallan({ sale, onClose }: Props) {
  const isRMC = sale.module === 'rmc';
  const rmcSale = isRMC ? (sale as RMCSale) : null;
  const blocksSale = !isRMC ? (sale as BlocksSale) : null;

  const description = isRMC
    ? `${rmcSale!.grade} Ready Mix Concrete`
    : `${blocksSale!.size}" Cement Blocks`;

  const unitLabel = isRMC ? 'm³' : 'Blocks';
  const totalBill = isRMC
    ? (rmcSale!.total_amount ?? rmcSale!.amount ?? 0)
    : (blocksSale!.amount ?? 0);
  const advance = sale.advance ?? 0;
  const balance = sale.balance ?? (totalBill - advance);
  const address = isRMC ? rmcSale!.site_address : blocksSale!.address;

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-challan-css';
    style.innerHTML = `
      @media print {
        body > * { display: none !important; }
        #print-challan-area {
          display: block !important;
          position: fixed !important;
          top: 0; left: 0; right: 0; bottom: 0;
          background: white;
          z-index: 99999;
          padding: 24px;
          font-family: Arial, sans-serif;
        }
        #print-challan-area * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('print-challan-css')?.remove(); };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh]">
        {/* Screen-only controls */}
        <div className="p-3 border-b flex items-center justify-between print:hidden">
          <span className="text-sm font-semibold text-slate-700">Delivery Challan #{sale.id}</span>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium cursor-pointer"
            >
              🖨 Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer px-1">×</button>
          </div>
        </div>

        {/* Challan Content */}
        <div id="print-challan-area" className="overflow-auto flex-1 p-5">
          {/* Company Header */}
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">ASTRA CONMIX</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {isRMC ? 'Ready Mix Concrete Manufacturers' : 'Cement Blocks Manufacturers'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Ph: 9866602006 · Rayadurgam, AP</p>
          </div>

          {/* Challan title & meta */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Delivery Challan</h2>
              <p className="text-xs text-slate-500">Challan No: {String(sale.id).padStart(4, '0')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-600">Date: <span className="font-semibold text-slate-800">{sale.date}</span></p>
              {sale.payment_mode && (
                <p className="text-xs text-slate-500 mt-0.5">Mode: {sale.payment_mode}</p>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Bill To</p>
            <p className="text-sm font-bold text-slate-800">{sale.customer_name || 'Customer'}</p>
            {address && <p className="text-xs text-slate-600 mt-0.5">{address}</p>}
            {sale.phone && <p className="text-xs text-slate-500 mt-0.5">Ph: {sale.phone}</p>}
          </div>

          {/* Items Table */}
          <table className="w-full text-sm mb-4 border border-slate-200 rounded overflow-hidden">
            <thead>
              <tr className="bg-slate-800 text-white text-xs">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-500">1</td>
                <td className="px-3 py-2 font-medium text-slate-800">{description}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmtNum(sale.quantity)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{unitLabel}</td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {sale.rate ? fmtCur(sale.rate) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{fmtCur(isRMC ? rmcSale!.amount : blocksSale!.amount)}</td>
              </tr>
              {isRMC && rmcSale!.pump_charge != null && rmcSale!.pump_charge > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-500">2</td>
                  <td className="px-3 py-2 text-slate-600">Pump Charge</td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right text-slate-500">—</td>
                  <td className="px-3 py-2 text-right text-slate-500">—</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtCur(rmcSale!.pump_charge)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="ml-auto w-60 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-800">{fmtCur(totalBill)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Advance Paid</span>
              <span className="font-medium text-emerald-600">{fmtCur(advance)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1.5">
              <span className="text-slate-800">Balance Due</span>
              <span className={balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmtCur(balance)}</span>
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="mt-4 p-2 bg-amber-50 border border-amber-100 rounded text-xs text-slate-600">
              <span className="font-semibold">Notes: </span>{sale.notes}
            </div>
          )}

          {/* Signature area */}
          <div className="mt-8 grid grid-cols-2 gap-8">
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="text-xs text-slate-500">Customer Signature</p>
            </div>
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="text-xs text-slate-500">Authorised Signatory</p>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400 mt-6">
            This is a computer generated delivery challan. Subject to {isRMC ? 'Rayadurgam' : 'Rayadurgam'} jurisdiction.
          </p>
        </div>
      </div>
    </div>
  );
}
