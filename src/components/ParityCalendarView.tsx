'use client';

import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, AlertTriangle, CheckCircle, TrendingDown, ChevronRight, ChevronLeft, Info, ExternalLink } from 'lucide-react';

interface CalendarDateData {
  id: string;
  date: string;
  checkOutDate: string;
  totalAudited: number;
  undercutCount: number;
  parityMatchCount: number;
  directAdvantageCount: number;
  totalLeakage: number;
  healthScore: number;
  status: string;
}

interface ParityCalendarViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onViewTableForDate: (date: string) => void;
  onOpenAuditModal: () => void;
}

export default function ParityCalendarView({
  selectedDate,
  onSelectDate,
  onViewTableForDate,
  onOpenAuditModal,
}: ParityCalendarViewProps) {
  const [calendarDates, setCalendarDates] = useState<CalendarDateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date('2026-09-01'));

  const fetchCalendar = () => {
    setLoading(true);
    fetch('/api/calendar')
      .then((res) => res.json())
      .then((data) => {
        if (data.dates) {
          setCalendarDates(data.dates);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  const activeDateData = calendarDates.find((d) => d.date === selectedDate) || calendarDates[0];

  const handlePrevMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(d);
  };

  const handleNextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(d);
  };

  // Generate days for the current month view
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const daysArray = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    daysArray.push(dateStr);
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-slate-700" />
            <span>Interactive Parity Rate Calendar</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Day-by-day distribution analytics retrieved from automated channel audits across StayVista's 1,187 properties.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs font-semibold">
          <button
            onClick={onOpenAuditModal}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all cursor-pointer shadow-xs"
          >
            + Run Analysis for Custom Date
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Full Monthly Calendar Grid */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          
          {/* Calendar Month Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <h3 className="text-base font-bold text-slate-900">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {calendarDates.length} Audited Dates
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center font-bold text-[11px] text-slate-400 uppercase tracking-wider mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Month Day Grid */}
          <div className="grid grid-cols-7 gap-2">
            {daysArray.map((dateStr, idx) => {
              if (!dateStr) {
                return <div key={`empty-${idx}`} className="h-20 rounded-lg bg-slate-50/40 border border-slate-100/50" />;
              }

              const auditData = calendarDates.find((cd) => cd.date === dateStr);
              const isSelected = dateStr === selectedDate;
              const hasUndercut = auditData && auditData.undercutCount > 0;
              const dayNum = parseInt(dateStr.split('-')[2], 10);

              return (
                <div
                  key={dateStr}
                  onClick={() => onSelectDate(dateStr)}
                  className={`h-20 p-2 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-md ring-2 ring-slate-900 ring-offset-1'
                      : auditData
                      ? hasUndercut
                        ? 'border-rose-200 bg-rose-50/30 hover:border-rose-400 hover:shadow-xs'
                        : 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-400 hover:shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {dayNum}
                    </span>
                    {auditData && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          hasUndercut ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                      />
                    )}
                  </div>

                  {auditData ? (
                    <div>
                      <p className={`text-[11px] font-bold ${isSelected ? 'text-rose-300' : 'text-rose-600'}`}>
                        ₹{Math.round(auditData.totalLeakage / 1000)}k Leak
                      </p>
                      <p className={`text-[10px] font-semibold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {auditData.undercutCount} Undercuts
                      </p>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Click to Audit</span>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Selected Date Output Findings Panel */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Analysis Output</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-white">
                {activeDateData?.totalAudited || 1187} Villas
              </span>
            </div>

            {/* Point-by-point date analysis findings */}
            <div className="mt-5 space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Date Audit Point Findings:</h4>

              <div className="flex items-start space-x-3 p-3 rounded-xl bg-rose-50 border border-rose-200">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900">
                    {activeDateData?.undercutCount || 0} Villas Undercut on {selectedDate}
                  </p>
                  <p className="text-rose-700 mt-0.5">
                    Total Margin Leakage of ₹{(activeDateData?.totalLeakage || 0).toLocaleString('en-IN')} caused by third-party discounts.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-900">
                    {activeDateData?.parityMatchCount || 0} Villas in Full Rate Alignment
                  </p>
                  <p className="text-emerald-700 mt-0.5">
                    Direct rack price matches OTA display pricing across all 5 channel URLs.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Info className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">
                    {activeDateData?.directAdvantageCount || 0} Direct Member Advantage Estates
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    StayVista direct exclusive member tier pricing is lower than third-party OTAs.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
            <button
              onClick={() => onViewTableForDate(selectedDate)}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <span>View All 1,187 Properties for {selectedDate}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenAuditModal}
              className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Re-Audit This Date Window
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
