'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PriceDataPoint, PowerLawFit, FittedDataPoint, PortfolioSummary } from '@/lib/types';
import { fitPowerLaw, applyFitToData, calculateRollingVolatility, calculatePortfolioSummary } from '@/lib/powerlaw';
import Controls from '@/components/Controls';
import PasswordGate, { useAuth } from '@/components/PasswordGate';

// Dynamic imports to avoid SSR issues with Chart.js
const PriceChart = dynamic(() => import('@/components/PriceChart'), { ssr: false });
const DeviationChart = dynamic(() => import('@/components/DeviationChart'), { ssr: false });
const VolatilityChart = dynamic(() => import('@/components/VolatilityChart'), { ssr: false });

const BTC_HELD_STORAGE_KEY = 'btc-powerlaw-btc-held';

function Dashboard() {
  const { handleLogout } = useAuth();
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [fittedData, setFittedData] = useState<FittedDataPoint[]>([]);
  const [fit, setFit] = useState<PowerLawFit | null>(null);
  const [fitStartDate, setFitStartDate] = useState('2013-01-01');
  const [isLogScale, setIsLogScale] = useState(true);
  const [showHalvings, setShowHalvings] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [btcHeld, setBtcHeld] = useState(0);

  // Load btcHeld from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(BTC_HELD_STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 0) {
          setBtcHeld(parsed);
        }
      }
    }
  }, []);

  // Save btcHeld to localStorage when it changes
  const handleBtcHeldChange = useCallback((value: number) => {
    setBtcHeld(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(BTC_HELD_STORAGE_KEY, value.toString());
    }
  }, []);

  // Get today's sigma deviation
  const currentSigma = useMemo(() => {
    if (fittedData.length === 0) return null;
    const lastPoint = fittedData[fittedData.length - 1];
    return lastPoint?.sigmaDeviation ?? null;
  }, [fittedData]);

  // Calculate rolling volatility data
  const volatilityData = useMemo(() => {
    if (fittedData.length === 0) return [];
    return calculateRollingVolatility(fittedData);
  }, [fittedData]);

  // Calculate portfolio summary for today
  const portfolioSummary = useMemo(() => {
    if (fittedData.length === 0 || btcHeld <= 0) return null;
    const lastPoint = fittedData[fittedData.length - 1];
    return calculatePortfolioSummary(lastPoint, btcHeld);
  }, [fittedData, btcHeld]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/btc-price');
      if (!response.ok) {
        throw new Error('Failed to fetch price data');
      }
      const data: PriceDataPoint[] = await response.json();
      // Convert date strings back to Date objects
      const parsedData = data.map(d => ({
        ...d,
        date: new Date(d.date),
      }));
      setPriceData(parsedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const performFit = useCallback(() => {
    if (priceData.length === 0) return;

    const startDate = new Date(fitStartDate);
    const dataForFit = priceData.filter(d => new Date(d.date) >= startDate);

    if (dataForFit.length < 10) {
      setError('Not enough data points for fitting. Please select an earlier start date.');
      return;
    }

    const newFit = fitPowerLaw(dataForFit);
    setFit(newFit);

    // Apply fit to all data for display
    const fitted = applyFitToData(priceData, newFit);
    setFittedData(fitted);
  }, [priceData, fitStartDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (priceData.length > 0) {
      performFit();
    }
  }, [priceData, performFit]);

  const handleRefit = () => {
    performFit();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1" />
            <h1 className="text-3xl md:text-4xl font-bold text-center flex-1">
              Bitcoin Power Law Dashboard
            </h1>
            <div className="flex-1 flex justify-end">
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded border border-gray-600 hover:border-gray-500 transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
          <p className="text-gray-400 text-center">
            Analyzing BTC price using the power-law model: price = A &times; t<sup>B</sup>
          </p>
        </header>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <Controls
          fitStartDate={fitStartDate}
          onFitStartDateChange={setFitStartDate}
          onRefit={handleRefit}
          isLogScale={isLogScale}
          onToggleScale={() => setIsLogScale(!isLogScale)}
          showHalvings={showHalvings}
          onToggleHalvings={() => setShowHalvings(!showHalvings)}
          fit={fit}
          isLoading={isLoading}
          currentSigma={currentSigma}
          btcHeld={btcHeld}
          onBtcHeldChange={handleBtcHeldChange}
          portfolioSummary={portfolioSummary}
        />

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-xl text-gray-400">Loading price data...</div>
          </div>
        ) : fittedData.length > 0 ? (
          <div className="grid gap-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <PriceChart data={fittedData} isLogScale={isLogScale} showHalvings={showHalvings} />
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <DeviationChart data={fittedData} showHalvings={showHalvings} />
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <VolatilityChart data={volatilityData} showHalvings={showHalvings} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-xl text-gray-400">No data available</div>
          </div>
        )}

        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>Data source: CryptoCompare + CoinGecko | Bitcoin genesis: January 3, 2009</p>
        </footer>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <PasswordGate>
      <Dashboard />
    </PasswordGate>
  );
}
