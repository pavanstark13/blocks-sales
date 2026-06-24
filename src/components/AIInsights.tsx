'use client';

import React, { useState } from 'react';

interface Projection {
  next_month_revenue: number;
  next_month_volume: number;
  confidence: 'low' | 'medium' | 'high';
  trend: 'growing' | 'stable' | 'declining';
  reasoning: string;
}

interface Insight {
  type: 'positive' | 'neutral' | 'warning';
  title: string;
  body: string;
}

interface Issue {
  severity: 'high' | 'medium' | 'low';
  title: string;
  body: string;
  customer?: string | null;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  detail: string;
}

interface Analysis {
  projection: Projection;
  insights: Insight[];
  issues: Issue[];
  recommendations: Recommendation[];
}

interface Props {
  reportData: unknown;
  module: 'blocks' | 'rmc';
  unitLabel?: string;
}

function fmtL(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

const CONFIDENCE_COLORS = { low: 'bg-slate-100 text-slate-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-emerald-100 text-emerald-700' };
const TREND_ICONS = { growing: '↑', stable: '→', declining: '↓' };
const TREND_COLORS = { growing: 'text-emerald-600', stable: 'text-blue-600', declining: 'text-rose-600' };
const INSIGHT_STYLES = {
  positive: { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', icon: '✓' },
  neutral:  { bar: 'bg-blue-400',    badge: 'bg-blue-100 text-blue-700',     icon: '○' },
  warning:  { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700',   icon: '⚠' },
};
const ISSUE_STYLES = {
  high:   { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
  medium: { bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  low:    { bar: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' },
};
const REC_COLORS = {
  high:   'border-l-red-400 bg-red-50',
  medium: 'border-l-amber-400 bg-amber-50',
  low:    'border-l-blue-400 bg-blue-50',
};

export default function AIInsights({ reportData, module: mod, unitLabel = 'units' }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData, module: mod }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unknown error');
      setAnalysis(data.analysis);
      setExpanded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const accentColor = mod === 'rmc' ? 'from-purple-600 to-indigo-600' : 'from-blue-600 to-cyan-600';
  const btnColor = mod === 'rmc'
    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
    : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700';

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
      {/* Header */}
      <div className={`bg-gradient-to-r ${accentColor} p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Business Insights</h3>
            <p className="text-xs text-white/70">Sales projections · Issue detection · Recommendations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analysis && (
            <button onClick={() => setExpanded(v => !v)}
              className="text-white/80 hover:text-white text-xs cursor-pointer px-2 py-1 rounded bg-white/10 hover:bg-white/20">
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          <button
            onClick={run}
            disabled={loading}
            className={`${btnColor} text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-60 transition-all flex items-center gap-2 border border-white/20`}
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Analysing…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {analysis ? 'Re-analyse' : 'Run AI Analysis'}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100">
          <p className="text-sm text-red-700 font-medium">⚠ {error}</p>
          {error.includes('ANTHROPIC_API_KEY') && (
            <p className="text-xs text-red-500 mt-1">
              Go to Vercel → Your Project → Settings → Environment Variables → Add <code className="bg-red-100 px-1 rounded">ANTHROPIC_API_KEY</code>
            </p>
          )}
        </div>
      )}

      {!analysis && !loading && !error && (
        <div className="p-6 text-center text-slate-400">
          <p className="text-sm">Click <strong>Run AI Analysis</strong> to get sales projections, insights, and recommendations powered by Claude AI.</p>
          <p className="text-xs mt-1 text-slate-300">Takes ~5 seconds · Analyses all your data</p>
        </div>
      )}

      {loading && (
        <div className="p-6 space-y-3 animate-pulse">
          {[80, 60, 90, 70].map((w, i) => (
            <div key={i} className="h-3 bg-slate-100 rounded-full" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {analysis && expanded && (
        <div className="p-4 space-y-5">

          {/* Projection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Next Month Projection</span>
                <div className="flex gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_COLORS[analysis.projection.confidence]}`}>
                    {analysis.projection.confidence} confidence
                  </span>
                  <span className={`text-sm font-bold ${TREND_COLORS[analysis.projection.trend]}`}>
                    {TREND_ICONS[analysis.projection.trend]} {analysis.projection.trend}
                  </span>
                </div>
              </div>
              <div className="flex gap-6 mb-2">
                <div>
                  <p className="text-2xl font-bold text-slate-800">{fmtL(analysis.projection.next_month_revenue)}</p>
                  <p className="text-xs text-slate-400">Projected Revenue</p>
                </div>
                <div className="border-l border-slate-200 pl-6">
                  <p className="text-2xl font-bold text-slate-800">{analysis.projection.next_month_volume} <span className="text-sm font-normal text-slate-400">{unitLabel}</span></p>
                  <p className="text-xs text-slate-400">Projected Volume</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{analysis.projection.reasoning}</p>
            </div>

            {/* Quick stats column */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex flex-col justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Insights found</span>
                  <span className="font-semibold text-blue-600">{analysis.insights.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Issues detected</span>
                  <span className="font-semibold text-rose-600">{analysis.issues.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Recommendations</span>
                  <span className="font-semibold text-emerald-600">{analysis.recommendations.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">High-priority</span>
                  <span className="font-semibold text-amber-600">
                    {analysis.issues.filter(i => i.severity === 'high').length + analysis.recommendations.filter(r => r.priority === 'high').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Insights + Issues side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Insights */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Key Insights</h4>
              <div className="space-y-2">
                {analysis.insights.map((ins, i) => {
                  const s = INSIGHT_STYLES[ins.type];
                  return (
                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className={`w-1 rounded-full flex-shrink-0 ${s.bar}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.badge}`}>{s.icon} {ins.type}</span>
                          <span className="text-xs font-semibold text-slate-700 truncate">{ins.title}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{ins.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Issues */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Issues & Alerts</h4>
              <div className="space-y-2">
                {analysis.issues.map((issue, i) => {
                  const s = ISSUE_STYLES[issue.severity];
                  return (
                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className={`w-1 rounded-full flex-shrink-0 ${s.bar}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.badge}`}>{issue.severity}</span>
                          <span className="text-xs font-semibold text-slate-700">{issue.title}</span>
                          {issue.customer && (
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{issue.customer}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{issue.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Actionable Recommendations</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {analysis.recommendations.map((rec, i) => (
                <div key={i} className={`border-l-4 rounded-r-lg p-3 ${REC_COLORS[rec.priority]}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{rec.priority}</span>
                    <span className="text-xs font-semibold text-slate-700">{rec.action}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{rec.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-300 text-right">Powered by Claude AI · Analysis is advisory only</p>
        </div>
      )}
    </div>
  );
}
