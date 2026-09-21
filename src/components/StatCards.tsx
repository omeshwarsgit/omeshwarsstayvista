'use client';

import React from 'react';
import { ShieldAlert, ShieldCheck, TrendingDown, Home } from 'lucide-react';

interface StatCardsProps {
  summary: {
    totalAudited: number;
    undercutCount: number;
    parityMatchCount: number;
    directAdvantageCount: number;
    totalLeakage: number;
  } | null;
}

export default function StatCards({ summary }: StatCardsProps) {
  if (!summary) return null;

  const total = summary.totalAudited || 50;
  const parityRate = total > 0 ? Math.round(((summary.parityMatchCount + summary.directAdvantageCount) / total) * 100) : 0;
  const undercutRate = total > 0 ? Math.round((summary.undercutCount / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      
      {/* Card 1: Total Portfolio */}
      <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-600">Master Portfolio</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{total.toLocaleString()} Villas</p>
          <p className="text-[11px] text-slate-400 mt-0.5">100% 5-Channel Monitored</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
          <Home className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>

      {/* Card 2: Total Margin Leakage */}
      <div className="bg-white px-3.5 py-2.5 rounded-xl border border-rose-200 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-rose-600">Margin Leakage</p>
          <p className="text-xl font-bold text-rose-600 mt-0.5">₹{summary.totalLeakage.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Leaked to OTA Discounts</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
          <TrendingDown className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>

      {/* Card 3: OTA Undercut Count */}
      <div className="bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-amber-600">OTA Undercuts</p>
          <div className="flex items-baseline space-x-2 mt-0.5">
            <p className="text-xl font-bold text-slate-900">{summary.undercutCount}</p>
            <span className="text-xs font-semibold text-amber-600">({undercutRate}%)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Action Required via PMS</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
          <ShieldAlert className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>

      {/* Card 4: Parity Health Rate */}
      <div className="bg-white px-3.5 py-2.5 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-emerald-600">Parity Health Score</p>
          <div className="flex items-baseline space-x-2 mt-0.5">
            <p className="text-xl font-bold text-slate-900">{parityRate}%</p>
            <span className="text-xs text-emerald-600 font-semibold">{summary.parityMatchCount} Parity</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{summary.directAdvantageCount} Direct Advantage</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>

    </div>
  );
}
