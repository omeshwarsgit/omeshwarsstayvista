'use client';

import React, { useEffect, useState } from 'react';
import { X, ExternalLink, ShieldAlert, ShieldCheck, CheckCircle2, TrendingDown, DollarSign, Calendar, MapPin, Tag } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DetailDrawerProps {
  propertyId: string | null;
  selectedDate: string;
  onClose: () => void;
}

export default function PropertyDetailDrawer({
  propertyId,
  selectedDate,
  onClose,
}: DetailDrawerProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) return;

    setLoading(true);
    fetch(`/api/property/${propertyId}?date=${selectedDate}`)
      .then((res) => res.json())
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [propertyId, selectedDate]);

  if (!propertyId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col justify-between border-l border-slate-200">
        
        {/* Drawer Header */}
        <div>
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-xs">
                  ID #{data?.property?.csvId || propertyId}
                </span>
                <span className="text-xs text-slate-400 font-medium">• Check-in {selectedDate}</span>
              </div>
              <h2 className="text-lg font-bold mt-1 text-white tracking-tight">
                {data?.property?.name || 'Property Details'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center animate-pulse">
              <p className="text-sm font-medium text-slate-600">Retrieving point-by-point property audit data...</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              
              {/* Property Key Overview */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block uppercase">Location</span>
                  <span className="font-bold text-slate-900 flex items-center mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 mr-1" />
                    {data.property.location}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block uppercase">Category (Normalized)</span>
                  <span className="font-bold text-slate-900 flex items-center mt-0.5">
                    <Tag className="w-3.5 h-3.5 text-slate-500 mr-1" />
                    {data.property.categoryNormalized}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block uppercase">Audit Parity Status</span>
                  <span
                    className={`font-bold inline-block mt-0.5 px-2 py-0.5 rounded-md text-[11px] ${
                      data.parityAudit?.parityStatus === 'OTA_UNDERCUT'
                        ? 'badge-undercut font-bold'
                        : 'badge-match font-bold'
                    }`}
                  >
                    {data.parityAudit?.parityStatus === 'OTA_UNDERCUT'
                      ? '⚠️ OTA UNDERCUT'
                      : '✅ PARITY MATCH'}
                  </span>
                </div>
              </div>

              {/* Point-by-Point Channel Rates Matrix */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  1. Side-by-Side Channel Rates & Direct URL Links
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                  
                  {/* SV Direct */}
                  <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-emerald-400">StayVista Direct</span>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold">
                        Master Rack Rate
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-base font-bold text-white">
                        ₹{data.parityAudit?.directPrice?.toLocaleString('en-IN')}
                      </span>
                      {(() => {
                        const linkObj = data.property.links?.['SV'];
                        const url = typeof linkObj === 'object' ? linkObj?.url : linkObj;
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
                          >
                            View Link <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Agoda */}
                  <div className="p-3.5 bg-white flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900">Agoda</span>
                        {(() => {
                          const linkObj = data.property.links?.['AGODA'];
                          const status = typeof linkObj === 'object' ? linkObj?.linkStatus : null;
                          if (!status || status === 'UNCHECKED') return null;
                          return (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              status === 'VALID' ? 'bg-emerald-50 text-emerald-700' :
                              status === 'REDIRECTED' ? 'bg-amber-50 text-amber-700' :
                              'bg-rose-50 text-rose-700'
                            }`}>
                              {status}
                            </span>
                          );
                        })()}
                      </div>
                      <span className="text-[11px] text-slate-500 block">Raw Tag: {data.priceSnapshots?.find((s: any) => s.channel === 'AGODA')?.categoryRaw || 'Villa'}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`font-bold text-sm ${data.parityAudit?.agodaPrice < data.parityAudit?.directPrice ? 'text-rose-600 font-black' : 'text-slate-900'}`}>
                        ₹{data.parityAudit?.agodaPrice?.toLocaleString('en-IN')}
                      </span>
                      {(() => {
                        const linkObj = data.property.links?.['AGODA'];
                        const url = typeof linkObj === 'object' ? linkObj?.url : linkObj;
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 underline"
                          >
                            Agoda Page <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* MakeMyTrip */}
                  <div className="p-3.5 bg-white flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900">MakeMyTrip (MMT)</span>
                        {(() => {
                          const linkObj = data.property.links?.['MMT'];
                          const status = typeof linkObj === 'object' ? linkObj?.linkStatus : null;
                          const wasRepaired = typeof linkObj === 'object' && Boolean(linkObj?.repairedUrl);
                          return (
                            <>
                              {wasRepaired && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-blue-50 text-blue-700">
                                  Auto-Repaired
                                </span>
                              )}
                              {status && status !== 'UNCHECKED' && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  status === 'VALID' ? 'bg-emerald-50 text-emerald-700' :
                                  status === 'REDIRECTED' ? 'bg-amber-50 text-amber-700' :
                                  'bg-rose-50 text-rose-700'
                                }`}>
                                  {status}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <span className="text-[11px] text-slate-500 block">Raw Tag: {data.priceSnapshots?.find((s: any) => s.channel === 'MMT')?.categoryRaw || 'Villa'}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`font-bold text-sm ${data.parityAudit?.mmtPrice < data.parityAudit?.directPrice ? 'text-rose-600 font-black' : 'text-slate-900'}`}>
                        ₹{data.parityAudit?.mmtPrice?.toLocaleString('en-IN')}
                      </span>
                      {(() => {
                        const linkObj = data.property.links?.['MMT'];
                        const url = typeof linkObj === 'object' ? linkObj?.url : linkObj;
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 underline"
                          >
                            MMT Page <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Booking.com */}
                  <div className="p-3.5 bg-white flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900">Booking.com</span>
                        {(() => {
                          const linkObj = data.property.links?.['BOOKING'];
                          const status = typeof linkObj === 'object' ? linkObj?.linkStatus : null;
                          if (!status || status === 'UNCHECKED') return null;
                          return (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              status === 'VALID' ? 'bg-emerald-50 text-emerald-700' :
                              status === 'REDIRECTED' ? 'bg-amber-50 text-amber-700' :
                              'bg-rose-50 text-rose-700'
                            }`}>
                              {status}
                            </span>
                          );
                        })()}
                      </div>
                      <span className="text-[11px] text-slate-500 block">Raw Tag: {data.priceSnapshots?.find((s: any) => s.channel === 'BOOKING')?.categoryRaw || 'Villa'}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`font-bold text-sm ${data.parityAudit?.bookingPrice < data.parityAudit?.directPrice ? 'text-rose-600 font-black' : 'text-slate-900'}`}>
                        ₹{data.parityAudit?.bookingPrice?.toLocaleString('en-IN')}
                      </span>
                      {(() => {
                        const linkObj = data.property.links?.['BOOKING'];
                        const url = typeof linkObj === 'object' ? linkObj?.url : linkObj;
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 underline"
                          >
                            Booking Page <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Airbnb */}
                  <div className="p-3.5 bg-white flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900">Airbnb</span>
                        {(() => {
                          const linkObj = data.property.links?.['AIRBNB'];
                          const status = typeof linkObj === 'object' ? linkObj?.linkStatus : null;
                          if (!status || status === 'UNCHECKED') return null;
                          return (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              status === 'VALID' ? 'bg-emerald-50 text-emerald-700' :
                              status === 'REDIRECTED' ? 'bg-amber-50 text-amber-700' :
                              'bg-rose-50 text-rose-700'
                            }`}>
                              {status}
                            </span>
                          );
                        })()}
                      </div>
                      <span className="text-[11px] text-slate-500 block">Raw Tag: {data.priceSnapshots?.find((s: any) => s.channel === 'AIRBNB')?.categoryRaw || 'Villa'}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`font-bold text-sm ${data.parityAudit?.airbnbPrice < data.parityAudit?.directPrice ? 'text-rose-600 font-black' : 'text-slate-900'}`}>
                        ₹{data.parityAudit?.airbnbPrice?.toLocaleString('en-IN')}
                      </span>
                      {(() => {
                        const linkObj = data.property.links?.['AIRBNB'];
                        const url = typeof linkObj === 'object' ? linkObj?.url : linkObj;
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 underline"
                          >
                            Airbnb Page <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>

                </div>
              </div>

              {/* Point 2: Itemized Tax & Fee Breakdown */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  2. Itemized Rate Structure (Base + 18% GST + Fees)
                </h3>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Rack Nightly Rate:</span>
                    <span className="font-semibold text-slate-900">₹{Math.round(data.parityAudit?.directPrice * 0.82).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST Tax (18% Luxury Villa Rate):</span>
                    <span className="font-semibold text-slate-900">₹{Math.round(data.parityAudit?.directPrice * 0.18).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Cleaning & Maintenance Charges:</span>
                    <span className="font-semibold text-slate-900">Included Direct</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                    <span>Final Payable Nightly Amount:</span>
                    <span className="text-emerald-700">₹{data.parityAudit?.directPrice?.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Point 3: Historical Trend Chart */}
              {data.history && data.history.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                    3. Historical Price Trend Across Audit Runs
                  </h3>
                  <div className="h-48 w-full border border-slate-200 rounded-xl p-3 bg-white">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} domain={['auto', 'auto']} />
                        <Tooltip />
                        <Line type="monotone" dataKey="directPrice" stroke="#0f172a" strokeWidth={2} name="StayVista Direct" />
                        <Line type="monotone" dataKey="agodaPrice" stroke="#e11d48" strokeWidth={1.5} name="Agoda" />
                        <Line type="monotone" dataKey="mmtPrice" stroke="#d97706" strokeWidth={1.5} name="MakeMyTrip" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Drawer Footer Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            StayVista Rate Parity Audit Engine v3
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close Detail Inspector
          </button>
        </div>

      </div>
    </div>
  );
}
