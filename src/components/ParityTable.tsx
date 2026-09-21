'use client';

import React from 'react';
import { Search, ExternalLink, ChevronLeft, ChevronRight, Eye, AlertTriangle } from 'lucide-react';

interface PropertyItem {
  id: string;
  csvId: number;
  name: string;
  location: string;
  category: string;
  directPrice: number;
  agodaPrice: number;
  mmtPrice: number;
  bookingPrice: number;
  airbnbPrice: number;
  lowestOtaChannel: string;
  lowestOtaPrice: number;
  parityStatus: string;
  marginLeakage: number;
  priceDifference: number;
  statusChanged: boolean;
  links: Record<string, string>;
  channelStatuses?: Record<string, string>;
}

interface ParityTableProps {
  properties: PropertyItem[];
  total: number;
  page: number;
  pages: number;
  onPageChange: (p: number) => void;
  search: string;
  onSearchChange: (s: string) => void;
  statusFilter: string;
  onStatusFilterChange: (st: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (c: string) => void;
  sortBy: string;
  onSortByChange: (sb: string) => void;
  onSelectProperty: (id: string) => void;
}

export default function ParityTable({
  properties,
  total,
  page,
  pages,
  onPageChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  sortBy,
  onSortByChange,
  onSelectProperty,
}: ParityTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Table Toolbar & Balanced Filters */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Balanced Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search properties by name or location"
            placeholder="Search 1,187 properties..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8 pl-8 pr-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {/* Balanced Filter Group with equalized control heights */}
        <div className="flex flex-wrap items-center gap-2">
          
          <select
            aria-label="Filter by parity status"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
          >
            <option value="ALL">All Parity Statuses</option>
            <option value="OTA_UNDERCUT">⚠️ OTA Undercut</option>
            <option value="PARITY_MATCH">✅ Parity Match</option>
            <option value="DIRECT_ADVANTAGE">💙 Direct Advantage</option>
          </select>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="Villa">Villa</option>
            <option value="Bungalow">Bungalow</option>
            <option value="Mansion">Mansion</option>
            <option value="Cottage">Cottage</option>
            <option value="Homestay">Homestay</option>
            <option value="Independent House">Independent House</option>
          </select>

          <select
            aria-label="Sort properties"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
          >
            <option value="leakage">Sort: Highest Leakage ₹</option>
            <option value="name">Sort: Property Name A-Z</option>
            <option value="directPrice">Sort: Highest Price</option>
          </select>

        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">ID</th>
              <th className="py-2.5 px-4">Property & Location</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3 text-right bg-slate-200/50 text-slate-900 font-bold">StayVista Direct</th>
              <th className="py-2.5 px-3 text-right">Agoda</th>
              <th className="py-2.5 px-3 text-right">MMT</th>
              <th className="py-2.5 px-3 text-right">Booking</th>
              <th className="py-2.5 px-3 text-right">Airbnb</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Margin Leakage</th>
              <th className="py-2.5 px-3 text-center">OTA Links</th>
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {properties.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400 font-medium">
                  No properties found matching your filter criteria.
                </td>
              </tr>
            ) : (
              properties.map((item) => {
                const isUndercut = item.parityStatus.includes('UNDERCUT');
                const isMatch = item.parityStatus.includes('MATCH');
                const isAdvantage = item.parityStatus === 'DIRECT_ADVANTAGE';
                const isPartial = item.parityStatus.startsWith('PARTIAL_');

                return (
                  <tr key={item.id} className="hover:bg-slate-50/75 transition-colors group">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 font-medium">
                      #{item.csvId}
                    </td>

                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        {item.statusChanged && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"
                            title="Status changed since previous audit"
                            aria-label="Status changed"
                          />
                        )}
                        <button
                          onClick={() => onSelectProperty(item.id)}
                          className="font-bold text-slate-900 hover:text-blue-600 text-left block line-clamp-1 cursor-pointer transition-colors"
                        >
                          {item.name}
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-400 font-normal block">
                        {item.location}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-normal text-slate-600">
                      {item.category}
                    </td>

                    {/* StayVista Direct Baseline */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 bg-slate-50 font-mono text-xs">
                      <div className="flex items-center justify-end space-x-1">
                        <span>₹{item.directPrice.toLocaleString('en-IN')}</span>
                        {(item.channelStatuses?.['SV'] === 'ESTIMATED' || item.channelStatuses?.['SV'] === 'SYNTHETIC') && (
                          <span title="Estimated baseline price (API fell back to baseline model)" className="text-amber-500 flex-shrink-0 cursor-help" aria-label="Estimated price">
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Agoda: Only highlight in red if it is the lowest causing the undercut */}
                    <td className={`py-2.5 px-3 text-right font-mono text-xs ${
                      item.lowestOtaChannel === 'AGODA' && item.agodaPrice < item.directPrice
                        ? 'text-rose-600 font-bold bg-rose-50/40 rounded'
                        : 'text-slate-600'
                    }`}>
                      <div className="flex items-center justify-end space-x-1">
                        <span>{item.agodaPrice > 0 ? `₹${item.agodaPrice.toLocaleString('en-IN')}` : '—'}</span>
                        {(item.channelStatuses?.['AGODA'] === 'ESTIMATED' || item.channelStatuses?.['AGODA'] === 'SYNTHETIC') && item.agodaPrice > 0 && (
                          <span title="Estimated baseline price (OTA extraction fell back to baseline model)" className="text-amber-500 flex-shrink-0 cursor-help" aria-label="Estimated price">
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* MakeMyTrip */}
                    <td className={`py-2.5 px-3 text-right font-mono text-xs ${
                      item.lowestOtaChannel === 'MMT' && item.mmtPrice < item.directPrice
                        ? 'text-rose-600 font-bold bg-rose-50/40 rounded'
                        : 'text-slate-600'
                    }`}>
                      <div className="flex items-center justify-end space-x-1">
                        <span>{item.mmtPrice > 0 ? `₹${item.mmtPrice.toLocaleString('en-IN')}` : '—'}</span>
                        {(item.channelStatuses?.['MMT'] === 'ESTIMATED' || item.channelStatuses?.['MMT'] === 'SYNTHETIC') && item.mmtPrice > 0 && (
                          <span title="Estimated baseline price (OTA extraction fell back to baseline model)" className="text-amber-500 flex-shrink-0 cursor-help" aria-label="Estimated price">
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Booking.com */}
                    <td className={`py-2.5 px-3 text-right font-mono text-xs ${
                      item.lowestOtaChannel === 'BOOKING' && item.bookingPrice < item.directPrice
                        ? 'text-rose-600 font-bold bg-rose-50/40 rounded'
                        : 'text-slate-600'
                    }`}>
                      <div className="flex items-center justify-end space-x-1">
                        <span>{item.bookingPrice > 0 ? `₹${item.bookingPrice.toLocaleString('en-IN')}` : '—'}</span>
                        {(item.channelStatuses?.['BOOKING'] === 'ESTIMATED' || item.channelStatuses?.['BOOKING'] === 'SYNTHETIC') && item.bookingPrice > 0 && (
                          <span title="Estimated baseline price (OTA extraction fell back to baseline model)" className="text-amber-500 flex-shrink-0 cursor-help" aria-label="Estimated price">
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Airbnb */}
                    <td className={`py-2.5 px-3 text-right font-mono text-xs ${
                      item.lowestOtaChannel === 'AIRBNB' && item.airbnbPrice < item.directPrice
                        ? 'text-rose-600 font-bold bg-rose-50/40 rounded'
                        : 'text-slate-600'
                    }`}>
                      <div className="flex items-center justify-end space-x-1">
                        <span>{item.airbnbPrice > 0 ? `₹${item.airbnbPrice.toLocaleString('en-IN')}` : '—'}</span>
                        {(item.channelStatuses?.['AIRBNB'] === 'ESTIMATED' || item.channelStatuses?.['AIRBNB'] === 'SYNTHETIC') && item.airbnbPrice > 0 && (
                          <span title="Estimated baseline price (OTA extraction fell back to baseline model)" className="text-amber-500 flex-shrink-0 cursor-help" aria-label="Estimated price">
                            <AlertTriangle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Parity Status Badge with Calmer Alert Styling */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          isUndercut
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isMatch
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isUndercut ? 'bg-rose-500' : isMatch ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          aria-hidden="true"
                        />
                        <span>
                          {isUndercut ? 'Undercut' : isMatch ? 'Match' : 'Advantage'}
                          {isPartial && <span className="text-[9px] opacity-75 ml-0.5">(Partial)</span>}
                        </span>
                      </span>
                    </td>

                    {/* Margin Leakage in neutral font to avoid alert fatigue */}
                    <td className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-slate-900">
                      {item.marginLeakage > 0 ? (
                        `₹${item.marginLeakage.toLocaleString('en-IN')}`
                      ) : (
                        <span className="text-slate-400 font-normal">₹0</span>
                      )}
                    </td>

                    {/* Interactive Clickable Channel Link Chips with External Icon */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {item.links?.['SV'] && (
                          <a
                            href={item.links['SV']}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="StayVista Direct Listing"
                            aria-label={`View ${item.name} on StayVista (opens in new tab)`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 hover:underline font-mono text-[10px] font-semibold transition-colors focus-visible:ring-1 focus-visible:ring-slate-900"
                          >
                            <span>SV</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" aria-hidden="true" />
                          </a>
                        )}
                        {item.links?.['AGODA'] && (
                          <a
                            href={item.links['AGODA']}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Agoda Listing"
                            aria-label={`View ${item.name} on Agoda (opens in new tab)`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 hover:underline font-mono text-[10px] font-semibold transition-colors focus-visible:ring-1 focus-visible:ring-slate-900"
                          >
                            <span>AG</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" aria-hidden="true" />
                          </a>
                        )}
                        {item.links?.['MMT'] && (
                          <a
                            href={item.links['MMT']}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="MakeMyTrip Listing"
                            aria-label={`View ${item.name} on MakeMyTrip (opens in new tab)`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 hover:underline font-mono text-[10px] font-semibold transition-colors focus-visible:ring-1 focus-visible:ring-slate-900"
                          >
                            <span>MMT</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" aria-hidden="true" />
                          </a>
                        )}
                        {item.links?.['BOOKING'] && (
                          <a
                            href={item.links['BOOKING']}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Booking.com Listing"
                            aria-label={`View ${item.name} on Booking.com (opens in new tab)`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 hover:underline font-mono text-[10px] font-semibold transition-colors focus-visible:ring-1 focus-visible:ring-slate-900"
                          >
                            <span>BK</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" aria-hidden="true" />
                          </a>
                        )}
                        {item.links?.['AIRBNB'] && (
                          <a
                            href={item.links['AIRBNB']}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Airbnb Listing"
                            aria-label={`View ${item.name} on Airbnb (opens in new tab)`}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 hover:underline font-mono text-[10px] font-semibold transition-colors focus-visible:ring-1 focus-visible:ring-slate-900"
                          >
                            <span>AB</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Subtle Ghost Inspect Action (Issue 4 Fix) */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onSelectProperty(item.id)}
                        aria-label={`Inspect details for ${item.name}`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer"
                        title="Inspect property audit details"
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 font-medium">
        <div>
          Showing <span className="font-bold text-slate-900">{properties.length}</span> of{' '}
          <span className="font-bold text-slate-900">{total.toLocaleString()}</span> Properties
        </div>

        <div className="flex items-center space-x-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <span>
            Page <span className="font-bold text-slate-900">{page}</span> of <span className="font-bold text-slate-900">{pages}</span>
          </span>
          <button
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

    </div>
  );
}
