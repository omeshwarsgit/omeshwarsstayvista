'use client';

import React, { useState, useEffect } from 'react';
import StatCards from '@/components/StatCards';
import ParityTable from '@/components/ParityTable';
import PropertyDetailDrawer from '@/components/PropertyDetailDrawer';
import { Calendar, RefreshCw, Download, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const [selectedDate, setSelectedDate] = useState('2026-10-10');
  const [properties, setProperties] = useState<any[]>([]);
  const [totalProperties, setTotalProperties] = useState(50);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('leakage');
  const [auditSummary, setAuditSummary] = useState<any>(null);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditSuccessMsg, setAuditSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProperties = () => {
    setLoading(true);
    const query = new URLSearchParams({
      search,
      date: selectedDate,
      status: statusFilter,
      category: categoryFilter,
      page: '1',
      limit: '50',
      sortBy,
    });

    fetch(`/api/properties?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.properties) {
          setProperties(data.properties);
          setTotalProperties(data.total);
          if (data.auditRun) {
            setAuditSummary(data.auditRun);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProperties();
  }, [selectedDate, search, statusFilter, categoryFilter, sortBy]);

  const handleRunParityCheck = () => {
    setIsAuditing(true);
    setAuditSuccessMsg(null);

    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const checkOutDate = nextDay.toISOString().split('T')[0];

    fetch('/api/parity/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkInDate: selectedDate,
        checkOutDate,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsAuditing(false);
        if (data.success) {
          setAuditSuccessMsg(`Checked parity for 50 properties! ${data.undercutCount} undercuts detected.`);
          fetchProperties();
          setTimeout(() => setAuditSuccessMsg(null), 5000);
        }
      })
      .catch((err) => {
        console.error('Parity check failed:', err);
        setIsAuditing(false);
      });
  };

  const handleExportCSV = () => {
    window.location.href = `/api/export?date=${selectedDate}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
              SV
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  StayVista Rate Parity Checking Tool
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" aria-hidden="true" />
                  50 Luxury Properties
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Live Parity Analysis Across StayVista, Agoda, MakeMyTrip, Booking.com & Airbnb
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunParityCheck}
              disabled={isAuditing}
              className="h-8 px-3.5 inline-flex items-center space-x-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isAuditing ? 'Checking Parity...' : 'Run Parity Check'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="h-8 px-3 inline-flex items-center space-x-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {/* Success Banner */}
        {auditSuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold">{auditSuccessMsg}</span>
            </div>
            <button onClick={() => setAuditSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Stay Date Selection Bar */}
        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-xs mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Audited Stay Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Audited stay date"
              className="h-8 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
            />
            <span className="text-slate-400 font-normal text-[11px] ml-1">
              (Links prefilled with this check-in date for 1-click manual verification)
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 font-normal">
            <span>Portfolio Scope:</span>
            <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              50 Properties
            </span>
          </div>
        </div>

        {/* 4 Core Summary Stat Cards */}
        <StatCards summary={auditSummary} />

        {/* 50-Property Parity Table */}
        <ParityTable
          properties={properties}
          total={totalProperties}
          page={1}
          pages={1}
          onPageChange={() => {}}
          search={search}
          onSearchChange={(s) => setSearch(s)}
          statusFilter={statusFilter}
          onStatusFilterChange={(st) => setStatusFilter(st)}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={(c) => setCategoryFilter(c)}
          sortBy={sortBy}
          onSortByChange={(sb) => setSortBy(sb)}
          onSelectProperty={(id) => setSelectedPropertyId(id)}
        />

      </main>

      {/* Point-by-Point Property Detail Drawer */}
      <PropertyDetailDrawer
        propertyId={selectedPropertyId}
        selectedDate={selectedDate}
        onClose={() => setSelectedPropertyId(null)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 mt-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          StayVista Rate Parity Checking Tool • Verified across 50 Luxury Villas on StayVista, Agoda, MakeMyTrip, Booking.com & Airbnb
        </div>
      </footer>

    </div>
  );
}
