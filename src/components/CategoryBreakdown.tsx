'use client';

import React from 'react';
import { Layers, Building, Home, TrendingDown } from 'lucide-react';

interface CategoryBreakdownProps {
  properties: any[];
}

export default function CategoryBreakdown({ properties }: CategoryBreakdownProps) {
  // Aggregate stats by normalized category
  const categoryStats: Record<string, { count: number; leakage: number; undercuts: number }> = {};

  properties.forEach((p) => {
    const cat = p.category || 'Villa';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { count: 0, leakage: 0, undercuts: 0 };
    }
    categoryStats[cat].count++;
    if (p.parityStatus === 'OTA_UNDERCUT') {
      categoryStats[cat].undercuts++;
      categoryStats[cat].leakage += p.marginLeakage || 0;
    }
  });

  const categoriesList = Object.keys(categoryStats).map((cat) => ({
    name: cat,
    count: categoryStats[cat].count,
    leakage: categoryStats[cat].leakage,
    undercuts: categoryStats[cat].undercuts,
  }));

  categoriesList.sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Layers className="w-5 h-5 text-slate-700" />
            <span>Category Distribution & Margin Leakage Taxonomy</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Normalized StayVista categories mapped against third-party OTA category tags (Agoda, MMT, Booking, Airbnb).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {categoriesList.map((cat) => (
          <div key={cat.name} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">{cat.name}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {cat.count} Properties
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-500">Margin Leakage:</span>
                <span className="text-sm font-bold text-rose-600">₹{cat.leakage.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-slate-500">OTA Undercuts:</span>
                <span className="text-xs font-semibold text-amber-700">{cat.undercuts} Properties</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between">
              <span>Raw OTA Tag:</span>
              <span className="font-mono text-slate-700">Entire {cat.name.toLowerCase()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
