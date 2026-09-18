'use client';

import React from 'react';
import { ShieldCheck, RefreshCw, Download, Layers, Calendar as CalendarIcon, Link2 } from 'lucide-react';

interface HeaderProps {
  selectedDate: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onExport: () => void;
  onValidateLinks?: () => void;
  isValidatingLinks?: boolean;
  activeTab: 'table' | 'calendar' | 'categories';
  setActiveTab: (tab: 'table' | 'calendar' | 'categories') => void;
  totalProperties: number;
}

export default function DashboardHeader({
  selectedDate,
  onRefresh,
  isRefreshing,
  onExport,
  onValidateLinks,
  isValidatingLinks,
  activeTab,
  setActiveTab,
  totalProperties,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Brand & Subtitle */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
              SV
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  StayVista Rate Parity Engine
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" aria-hidden="true" />
                  Live Auditing
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Multi-Channel Distribution Audit • {totalProperties.toLocaleString()} Verified Luxury Estates
              </p>
            </div>
          </div>

          {/* Navigation Tabs with WAI-ARIA tablist */}
          <nav
            role="tablist"
            aria-label="Dashboard Views"
            className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200"
          >
            <button
              role="tab"
              id="tab-table"
              aria-selected={activeTab === 'table'}
              aria-controls="panel-table"
              onClick={() => setActiveTab('table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Audit Table</span>
            </button>

            <button
              role="tab"
              id="tab-calendar"
              aria-selected={activeTab === 'calendar'}
              aria-controls="panel-calendar"
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Parity Calendar</span>
            </button>

            <button
              role="tab"
              id="tab-categories"
              aria-selected={activeTab === 'categories'}
              aria-controls="panel-categories"
              onClick={() => setActiveTab('categories')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer ${
                activeTab === 'categories'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Categories</span>
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {onValidateLinks && (
              <button
                onClick={onValidateLinks}
                disabled={isValidatingLinks}
                className="h-8 px-3 inline-flex items-center space-x-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 shadow-xs"
                title="Validate channel links and auto-repair malformed URLs"
              >
                <Link2 className={`w-3.5 h-3.5 ${isValidatingLinks ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>{isValidatingLinks ? 'Validating...' : 'Validate Links'}</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-8 px-3 inline-flex items-center space-x-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isRefreshing ? 'Auditing...' : 'Run Audit'}</span>
            </button>

            <button
              onClick={onExport}
              className="h-8 px-3.5 inline-flex items-center space-x-1.5 rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
