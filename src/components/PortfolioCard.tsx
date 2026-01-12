'use client';

import { PortfolioSummary, getValuationZone, getValuationLabel, ValuationZone } from '@/lib/types';

interface PortfolioCardProps {
  summary: PortfolioSummary;
  currentSigma: number | null;
}

function getZoneColor(zone: ValuationZone): string {
  switch (zone) {
    case 'deep-value': return 'text-green-400';
    case 'undervalued': return 'text-emerald-400';
    case 'fair': return 'text-slate-300';
    case 'overvalued': return 'text-orange-400';
    case 'bubble': return 'text-red-400';
  }
}

function getZoneBgColor(zone: ValuationZone): string {
  switch (zone) {
    case 'deep-value': return 'bg-green-900/50 border-green-600';
    case 'undervalued': return 'bg-emerald-900/50 border-emerald-600';
    case 'fair': return 'bg-slate-700/50 border-slate-500';
    case 'overvalued': return 'bg-orange-900/50 border-orange-600';
    case 'bubble': return 'bg-red-900/50 border-red-600';
  }
}

function formatUSD(value: number): string {
  if (value >= 1000000000) {
    return '$' + (value / 1000000000).toFixed(2) + 'B';
  }
  if (value >= 1000000) {
    return '$' + (value / 1000000).toFixed(2) + 'M';
  }
  if (value >= 1000) {
    return '$' + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return '$' + value.toFixed(2);
}

export default function PortfolioCard({ summary, currentSigma }: PortfolioCardProps) {
  const zone = currentSigma !== null ? getValuationZone(currentSigma) : null;

  return (
    <div className={`w-full rounded-lg border px-4 py-4 md:px-6 md:py-5 ${zone ? getZoneBgColor(zone) : 'bg-gray-700/50 border-gray-600'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-300">Portfolio Today</span>
        {zone && (
          <span className={`text-sm font-medium px-2 py-0.5 rounded ${getZoneColor(zone)} bg-gray-800/50`}>
            {getValuationLabel(zone)}
          </span>
        )}
      </div>

      {/* 3-column responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Column 1: BTC Held & Current Value */}
        <div className="space-y-3">
          <div className="bg-gray-800/40 rounded px-3 py-2">
            <div className="text-xs text-gray-400 mb-1">BTC Held</div>
            <div className="text-lg font-mono text-orange-400">
              {summary.btcHeld.toFixed(4)} BTC
            </div>
          </div>
          <div className="bg-gray-800/40 rounded px-3 py-2">
            <div className="text-xs text-gray-400 mb-1">Current Value</div>
            <div className="text-lg font-mono text-purple-400">
              {formatUSD(summary.currentValue)}
            </div>
          </div>
        </div>

        {/* Column 2: Fair Value & Classification */}
        <div className="space-y-3">
          <div className="bg-gray-800/40 rounded px-3 py-2">
            <div className="text-xs text-gray-400 mb-1">Fair Value (Model)</div>
            <div className="text-lg font-mono text-blue-400">
              {formatUSD(summary.fairValue)}
            </div>
          </div>
          <div className="bg-gray-800/40 rounded px-3 py-2">
            <div className="text-xs text-gray-400 mb-1">Valuation Status</div>
            <div className={`text-lg font-semibold ${zone ? getZoneColor(zone) : 'text-gray-300'}`}>
              {zone ? getValuationLabel(zone) : 'N/A'}
              {currentSigma !== null && (
                <span className="ml-2 font-mono text-base">
                  ({currentSigma >= 0 ? '+' : ''}{currentSigma.toFixed(2)}&sigma;)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Band Values */}
        <div className="bg-gray-800/40 rounded px-3 py-2 sm:col-span-2 lg:col-span-1">
          <div className="text-xs text-gray-400 mb-2">Portfolio at Band Values</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <span className="text-xs text-red-400/80">+2&sigma; (Bubble)</span>
              <div className="font-mono text-base text-red-400">{formatUSD(summary.band2SigmaUpper)}</div>
            </div>
            <div>
              <span className="text-xs text-orange-400/80">+1&sigma; (Expensive)</span>
              <div className="font-mono text-base text-orange-400">{formatUSD(summary.band1SigmaUpper)}</div>
            </div>
            <div>
              <span className="text-xs text-emerald-400/80">&minus;1&sigma; (Undervalued)</span>
              <div className="font-mono text-base text-emerald-400">{formatUSD(summary.band1SigmaLower)}</div>
            </div>
            <div>
              <span className="text-xs text-green-400/80">&minus;2&sigma; (Deep Value)</span>
              <div className="font-mono text-base text-green-400">{formatUSD(summary.band2SigmaLower)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
