'use client';

import React, { useState } from 'react';
import { Calendar, X, Play, Clock, CheckSquare } from 'lucide-react';

interface AuditDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunAudit: (checkInDate: string, checkOutDate: string) => void;
  isAuditing: boolean;
}

export default function AuditDateModal({
  isOpen,
  onClose,
  onRunAudit,
  isAuditing,
}: AuditDateModalProps) {
  const [checkInDate, setCheckInDate] = useState('2026-09-16');
  const [checkOutDate, setCheckOutDate] = useState('2026-09-17');
  const [stayWindow, setStayWindow] = useState('1'); // 1 night, 2 nights, 3 nights

  if (!isOpen) return null;

  const handleCheckInChange = (date: string) => {
    setCheckInDate(date);
    const d = new Date(date);
    d.setDate(d.getDate() + parseInt(stayWindow, 10));
    setCheckOutDate(d.toISOString().split('T')[0]);
  };

  const handleStayWindowChange = (nights: string) => {
    setStayWindow(nights);
    const d = new Date(checkInDate);
    d.setDate(d.getDate() + parseInt(nights, 10));
    setCheckOutDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunAudit(checkInDate, checkOutDate);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm tracking-tight text-white">
              Configure Rate Parity Audit Window
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs text-slate-700">
          
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="font-semibold text-slate-900 mb-1">Stay Window & Date Selection</p>
            <p className="text-slate-500 leading-relaxed">
              Select the check-in and check-out dates to audit rate parity across StayVista Direct vs Agoda, MMT, Booking.com, and Airbnb.
            </p>
          </div>

          {/* Quick Stay Window Selection */}
          <div>
            <label className="font-bold text-slate-800 block mb-1.5 uppercase tracking-wider text-[11px]">
              Stay Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleStayWindowChange('1')}
                className={`py-2 px-3 rounded-lg font-semibold border transition-all cursor-pointer ${
                  stayWindow === '1'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                1 Night
              </button>
              <button
                type="button"
                onClick={() => handleStayWindowChange('2')}
                className={`py-2 px-3 rounded-lg font-semibold border transition-all cursor-pointer ${
                  stayWindow === '2'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                2 Nights (Weekend)
              </button>
              <button
                type="button"
                onClick={() => handleStayWindowChange('3')}
                className={`py-2 px-3 rounded-lg font-semibold border transition-all cursor-pointer ${
                  stayWindow === '3'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                3 Nights
              </button>
            </div>
          </div>

          {/* Date Picker Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1 uppercase tracking-wider text-[11px]">
                Check-In Date
              </label>
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => handleCheckInChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1 uppercase tracking-wider text-[11px]">
                Check-Out Date
              </label>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700 focus:outline-none cursor-not-allowed"
                readOnly
              />
            </div>
          </div>

          {/* Target Channels Badge List */}
          <div>
            <label className="font-bold text-slate-800 block mb-1.5 uppercase tracking-wider text-[11px]">
              Channels Included in Audit (5-Platform Matrix)
            </label>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-bold text-[10px]">StayVista Direct</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-[10px]">Agoda</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-[10px]">MakeMyTrip</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-[10px]">Booking.com</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-[10px]">Airbnb</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAuditing}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isAuditing ? 'Auditing 1,187 Villas...' : 'Start Audit Analysis'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
