'use client';

import { useState, useEffect } from 'react';
import { PowerLawFit, PortfolioSummary, getValuationZone, getValuationLabel, ValuationZone } from '@/lib/types';
import PortfolioCard from './PortfolioCard';

interface ControlsProps {
  fitStartDate: string;
  onFitStartDateChange: (date: string) => void;
  onRefit: () => void;
  isLogScale: boolean;
  onToggleScale: () => void;
  showHalvings: boolean;
  onToggleHalvings: () => void;
  fit: PowerLawFit | null;
  isLoading: boolean;
  currentSigma: number | null;
  btcHeld: number;
  onBtcHeldChange: (value: number) => void;
  portfolioSummary: PortfolioSummary | null;
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

export default function Controls({
  fitStartDate,
  onFitStartDateChange,
  onRefit,
  isLogScale,
  onToggleScale,
  showHalvings,
  onToggleHalvings,
  fit,
  isLoading,
  currentSigma,
  btcHeld,
  onBtcHeldChange,
  portfolioSummary,
}: ControlsProps) {
  const zone = currentSigma !== null ? getValuationZone(currentSigma) : null;

  // Use string state for natural input behavior (no cursor jumping or forced formatting)
  const [btcHeldInput, setBtcHeldInput] = useState(() => btcHeld > 0 ? String(btcHeld) : '');

  // Sync input display when btcHeld changes externally (e.g., from localStorage on mount)
  useEffect(() => {
    setBtcHeldInput(btcHeld > 0 ? String(btcHeld) : '');
  }, [btcHeld]);

  const handleBtcHeldInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty, digits, and one decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setBtcHeldInput(value);
      // Update numeric value for calculations (0 if empty or invalid)
      const numValue = parseFloat(value);
      onBtcHeldChange(isNaN(numValue) || numValue < 0 ? 0 : numValue);
    }
  };

  const handleBtcHeldBlur = () => {
    // Clean up display on blur (remove trailing dot, etc.) but preserve user's precision
    const numValue = parseFloat(btcHeldInput);
    if (isNaN(numValue) || numValue <= 0) {
      setBtcHeldInput('');
      onBtcHeldChange(0);
    } else {
      // Keep the user's input format, just normalize trailing decimals
      const cleaned = btcHeldInput.replace(/\.$/, '');
      setBtcHeldInput(cleaned);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="fitStartDate" className="text-sm text-gray-400">
              Fit Start Date
            </label>
            <input
              type="date"
              id="fitStartDate"
              value={fitStartDate}
              onChange={(e) => onFitStartDateChange(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              min="2010-07-17"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="btcHeld" className="text-sm text-gray-400">
              BTC Held
            </label>
            <input
              type="text"
              inputMode="decimal"
              id="btcHeld"
              value={btcHeldInput}
              onChange={handleBtcHeldInputChange}
              onBlur={handleBtcHeldBlur}
              className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-orange-500 focus:outline-none w-32"
              placeholder="0"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={onRefit}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors"
            >
              {isLoading ? 'Fitting...' : 'Re-fit Model'}
            </button>

            <button
              onClick={onToggleScale}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              {isLogScale ? 'Linear Scale' : 'Log Scale'}
            </button>

            {/* Halvings Toggle */}
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={showHalvings}
                onChange={onToggleHalvings}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
              <span className="text-sm text-gray-300">Halvings</span>
            </label>
          </div>
        </div>

        {fit && (
          <div className="flex flex-wrap gap-3 md:gap-4">
            <div className="bg-gray-700 px-3 py-2 rounded">
              <div className="text-xs text-gray-400">A (coefficient)</div>
              <div className="text-base font-mono text-orange-400">
                {fit.A.toExponential(3)}
              </div>
            </div>
            <div className="bg-gray-700 px-3 py-2 rounded">
              <div className="text-xs text-gray-400">B (exponent)</div>
              <div className="text-base font-mono text-blue-400">
                {fit.B.toFixed(4)}
              </div>
            </div>
            <div className="bg-gray-700 px-3 py-2 rounded">
              <div className="text-xs text-gray-400">R&sup2;</div>
              <div className="text-base font-mono text-green-400">
                {fit.rSquared.toFixed(4)}
              </div>
            </div>
            <div className="bg-gray-700 px-3 py-2 rounded">
              <div className="text-xs text-gray-400">&sigma; (log residuals)</div>
              <div className="text-base font-mono text-purple-400">
                {fit.sigma.toFixed(4)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current valuation indicator */}
      {currentSigma !== null && zone && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded border ${getZoneBgColor(zone)}`}>
            <span className="text-sm text-gray-300">Today&apos;s Valuation:</span>
            <span className={`text-2xl font-bold font-mono ${getZoneColor(zone)}`}>
              {currentSigma >= 0 ? '+' : ''}{currentSigma.toFixed(2)}&sigma;
            </span>
            <span className={`text-sm font-medium ${getZoneColor(zone)}`}>
              ({getValuationLabel(zone)})
            </span>
          </div>
          <div className="text-xs text-gray-500">
            &minus;2&sigma; = Deep Value | &minus;1&sigma; to +1&sigma; = Fair | +2&sigma; = Bubble
          </div>
        </div>
      )}

      {/* Portfolio summary panel - full width, only shown when btcHeld > 0 */}
      {portfolioSummary && portfolioSummary.btcHeld > 0 && (
        <div className="mt-4">
          <PortfolioCard summary={portfolioSummary} currentSigma={currentSigma} />
        </div>
      )}

      {fit && (
        <div className="mt-4 text-sm text-gray-400">
          Model: <span className="font-mono text-white">price = {fit.A.toExponential(2)} &times; t<sup>{fit.B.toFixed(3)}</sup></span>
          <span className="ml-2 text-gray-500">(t = days since Bitcoin genesis on 2009-01-03)</span>
        </div>
      )}
    </div>
  );
}
