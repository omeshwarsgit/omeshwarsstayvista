'use client';

import React, { useState, useEffect } from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import StatCards from '@/components/StatCards';
import ParityTable from '@/components/ParityTable';
import ParityCalendarView from '@/components/ParityCalendarView';
import CategoryBreakdown from '@/components/CategoryBreakdown';
import PropertyDetailDrawer from '@/components/PropertyDetailDrawer';
import AuditDateModal from '@/components/AuditDateModal';
import ScraperStatusPanel from '@/components/ScraperStatusPanel';
import { Calendar } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'table' | 'calendar' | 'categories'>('table');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [properties, setProperties] = useState<any[]>([]);
  const [totalProperties, setTotalProperties] = useState(1187);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('leakage');
  const [auditSummary, setAuditSummary] = useState<any>(null);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isValidatingLinks, setIsValidatingLinks] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchProperties = () => {
    if (!selectedDate) {
      setProperties([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const query = new URLSearchParams({
      search,
      date: selectedDate,
      status: statusFilter,
      category: categoryFilter,
      page: page.toString(),
      limit: '50',
      sortBy,
    });

    fetch(`/api/properties?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.properties) {
          setProperties(data.properties);
          setTotalProperties(data.total);
          setPages(data.pages);
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
    if (selectedDate) {
      fetchProperties();
    } else {
      setProperties([]);
      setLoading(false);
    }
  }, [selectedDate, page, search, statusFilter, categoryFilter, sortBy]);

  const handleStartAudit = (checkInDate: string, checkOutDate: string) => {
    setIsAuditing(true);
    fetch('/api/audit/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkInDate,
        checkOutDate,
        mode: 'INCREMENTAL',
        limit: 30, // Pilot batch limit
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsAuditing(false);
        setIsAuditModalOpen(false);
        setSelectedDate(checkInDate);
        if (data.runId) {
          setActiveRunId(data.runId);
        } else {
          fetchProperties();
        }
      })
      .catch((err) => {
        console.error(err);
        setIsAuditing(false);
      });
  };

  const handleValidateLinks = () => {
    setIsValidatingLinks(true);
    fetch('/api/links/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 50 }),
    })
      .then((res) => res.json())
      .then(() => {
        setIsValidatingLinks(false);
        if (selectedDate) fetchProperties();
      })
      .catch((err) => {
        console.error('Error validating links:', err);
        setIsValidatingLinks(false);
      });
  };

  const handleExportCSV = () => {
    if (selectedDate) {
      window.location.href = `/api/export?date=${selectedDate}`;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Sticky Dashboard Header */}
      <DashboardHeader
        selectedDate={selectedDate}
        onRefresh={() => setIsAuditModalOpen(true)}
        isRefreshing={isAuditing}
        onExport={handleExportCSV}
        onValidateLinks={handleValidateLinks}
        isValidatingLinks={isValidatingLinks}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalProperties={totalProperties}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {/* Scraper Live Status Panel (shown when a run is active) */}
        {activeRunId && (
          <ScraperStatusPanel
            runId={activeRunId}
            onComplete={() => {
              fetchProperties();
            }}
            onDismiss={() => setActiveRunId(null)}
          />
        )}

        {/* Date Landing State or Audited Dashboard */}
        {!selectedDate ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto my-8">
            <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xs">
              <Calendar className="w-7 h-7 text-slate-100" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
              Select Stay Dates to Inspect Rate Parity
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Live multi-channel rate parity auditing requires a target stay window. Choose your Check-In and Check-Out dates below to retrieve audited properties or trigger a live scraping run.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Check-In Date</label>
                  <input
                    type="date"
                    defaultValue="2026-09-16"
                    id="landing-checkin"
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Check-Out Date</label>
                  <input
                    type="date"
                    defaultValue="2026-09-17"
                    id="landing-checkout"
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={() => {
                    const checkIn = (document.getElementById('landing-checkin') as HTMLInputElement)?.value || '2026-09-16';
                    setSelectedDate(checkIn);
                  }}
                  className="flex-1 h-10 px-4 inline-flex items-center justify-center rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
                >
                  View Audited Parity For Date
                </button>
                <button
                  onClick={() => setIsAuditModalOpen(true)}
                  className="h-10 px-4 inline-flex items-center justify-center rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Configure & Run Live Scraper
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
              <span className="font-medium">Quick Presets:</span>
              <button
                onClick={() => setSelectedDate('2026-09-16')}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
              >
                2026-09-16 (Initial Audit)
              </button>
              <button
                onClick={() => setSelectedDate('2026-09-17')}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
              >
                2026-09-17 (Peak Day)
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Date Selector Bar */}
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
                <button
                  onClick={() => setIsAuditModalOpen(true)}
                  className="h-8 px-3 ml-2 inline-flex items-center rounded-lg text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  Configure Dates
                </button>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="h-8 px-2.5 inline-flex items-center rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Change stay dates"
                >
                  Clear Date
                </button>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-500 font-normal">
                <span>Audit Run ID:</span>
                <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {auditSummary?.id ? auditSummary.id.slice(0, 8) : 'ACTIVE'}
                </span>
              </div>
            </div>

            {/* Stat Summary Cards */}
            <StatCards summary={auditSummary} />

            {/* Dynamic Tab Content */}
            {activeTab === 'calendar' ? (
              <ParityCalendarView
                selectedDate={selectedDate}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                }}
                onViewTableForDate={(date) => {
                  setSelectedDate(date);
                  setActiveTab('table');
                }}
                onOpenAuditModal={() => setIsAuditModalOpen(true)}
              />
            ) : activeTab === 'categories' ? (
              <CategoryBreakdown properties={properties} />
            ) : (
              <ParityTable
                properties={properties}
                total={totalProperties}
                page={page}
                pages={pages}
                onPageChange={(p) => setPage(p)}
                search={search}
                onSearchChange={(s) => {
                  setSearch(s);
                  setPage(1);
                }}
                statusFilter={statusFilter}
                onStatusFilterChange={(st) => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={(c) => {
                  setCategoryFilter(c);
                  setPage(1);
                }}
                sortBy={sortBy}
                onSortByChange={(sb) => setSortBy(sb)}
                onSelectProperty={(id) => setSelectedPropertyId(id)}
              />
            )}
          </>
        )}

      </main>

      {/* Audit Date & Stay Window Configuration Modal */}
      <AuditDateModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onRunAudit={handleStartAudit}
        isAuditing={isAuditing}
      />

      {/* Point-by-Point Property Detail Drawer */}
      {selectedPropertyId && selectedDate && (
        <PropertyDetailDrawer
          propertyId={selectedPropertyId}
          selectedDate={selectedDate}
          onClose={() => setSelectedPropertyId(null)}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 mt-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          StayVista Rate Parity Engine • Enterprise Revenue Intelligence Platform • 1,187 Verified Luxury Villas Monitored
        </div>
      </footer>

    </div>
  );
}
