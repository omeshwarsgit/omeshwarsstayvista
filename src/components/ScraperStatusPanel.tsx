'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, XCircle, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ScraperStatusPanelProps {
  runId: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export default function ScraperStatusPanel({
  runId,
  onComplete,
  onDismiss,
}: ScraperStatusPanelProps) {
  const [statusData, setStatusData] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!runId) return;

    let isMounted = true;
    const fetchStatus = () => {
      fetch(`/api/audit/status/${runId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          setStatusData(data);

          if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
            if (data.status === 'COMPLETED') {
              onComplete();
            }
          }
        })
        .catch((err) => console.error('Error fetching audit status:', err));
    };

    fetchStatus();
    const interval = setInterval(() => {
      if (statusData?.status !== 'COMPLETED' && statusData?.status !== 'CANCELLED') {
        fetchStatus();
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [runId]);

  const handleCancel = () => {
    setCancelling(true);
    fetch(`/api/audit/cancel/${runId}`, { method: 'POST' })
      .then((res) => res.json())
      .then(() => {
        setCancelling(false);
      })
      .catch(() => setCancelling(false));
  };

  if (!statusData) return null;

  const isRunning = statusData.status === 'RUNNING';
  const isCompleted = statusData.status === 'COMPLETED';
  const isCancelled = statusData.status === 'CANCELLED';

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          {isRunning ? (
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
          ) : isCompleted ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                {isRunning
                  ? 'Audit in Progress'
                  : isCompleted
                  ? 'Audit Completed'
                  : 'Audit Cancelled'}
              </h3>
              <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Run #{statusData.id ? statusData.id.slice(0, 8) : 'ACTIVE'}
              </span>
              <span className="text-xs text-slate-500">• {statusData.mode || 'FULL'} Mode</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditing check-in date: <span className="font-semibold text-slate-700">{statusData.checkInDate}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isRunning && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="h-8 px-3 inline-flex items-center space-x-1.5 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{cancelling ? 'Cancelling...' : 'Cancel Audit'}</span>
            </button>
          )}
          {!isRunning && (
            <button
              onClick={onDismiss}
              className="h-8 px-3 inline-flex items-center space-x-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span>Dismiss</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3.5">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="font-semibold text-slate-700">
            {statusData.processedCount || 0} of {statusData.totalAudited || 0} properties processed
          </span>
          <span className="font-bold text-slate-900">{statusData.progressPercent || 0}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted ? 'bg-emerald-500' : isCancelled ? 'bg-amber-500' : 'bg-slate-900'
            }`}
            style={{ width: `${statusData.progressPercent || 0}%` }}
          />
        </div>

        {/* Live Active Property Info */}
        {isRunning && statusData.currentProperty && (
          <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-blue-50/70 border border-blue-100 flex items-center justify-between text-xs animate-pulse">
            <span className="text-slate-600 font-medium">
              Scraping Property <strong className="text-slate-900">#{statusData.currentProperty.index}</strong> of <strong className="text-slate-900">{statusData.totalAudited || 50}</strong>:
            </span>
            <span className="font-semibold text-blue-700 truncate max-w-[280px]">
              {statusData.currentProperty.name} {statusData.currentProperty.location ? `(${statusData.currentProperty.location})` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Real-time stats during run */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Parity Matches</span>
          <span className="font-bold text-slate-900 text-sm">{statusData.parityMatchCount || 0}</span>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-slate-500 block text-[11px]">OTA Undercuts</span>
          <span className="font-bold text-rose-600 text-sm">{statusData.undercutCount || 0}</span>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Direct Advantage</span>
          <span className="font-bold text-blue-600 text-sm">{statusData.directAdvantageCount || 0}</span>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-slate-500 block text-[11px]">Margin Leakage</span>
          <span className="font-bold text-slate-900 text-sm">₹{(statusData.totalLeakage || 0).toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  );
}
