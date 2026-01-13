'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PriceDataPoint, PowerLawFit } from '@/lib/types';
import { fitPowerLaw } from '@/lib/powerlaw';
import { BBDSimulatorConfig, runBBDSimulation, BBDSimulationResult, HistoricalPricePoint } from '@/lib/bbd-simulator';
import PasswordGate, { useAuth } from '@/components/PasswordGate';
import BBDControls from '@/components/BBDControls';
import BBDKpiCards from '@/components/BBDKpiCards';
import BBDResultsTable from '@/components/BBDResultsTable';

// Dynamic import for charts to avoid SSR issues
const BBDCharts = dynamic(() => import('@/components/BBDCharts'), { ssr: false });

const BTC_HELD_STORAGE_KEY = 'btc-powerlaw-btc-held';

// Get current month in YYYY-MM format
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const DEFAULT_CONFIG: BBDSimulatorConfig = {
  btcHeld: 1,
  monthlySpendingUsd: 5000,
  interestAprPercent: 10,
  liquidationLtvPercent: 80,
  startingLtvPercent: null,
  borrowMonthly: true,
  borrowFrequency: 'monthly',
  interestMode: 'capitalize',
  projectionYears: 20,
  scenario: 'fair',
  startDate: getCurrentMonth(),
};

// Default BTC Held value
const DEFAULT_BTC_HELD = 1;

function BBDDashboard() {
  const { handleLogout } = useAuth();
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [fit, setFit] = useState<PowerLawFit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [btcHeld, setBtcHeld] = useState(DEFAULT_BTC_HELD);
  const [config, setConfig] = useState<BBDSimulatorConfig>(DEFAULT_CONFIG);

  // Note: BBD page always starts with default values - no localStorage restore
  // localStorage is only written to (not read from) for cross-page sharing

  // Save btcHeld to localStorage when it changes
  const handleBtcHeldChange = useCallback((value: number) => {
    setBtcHeld(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(BTC_HELD_STORAGE_KEY, value.toString());
    }
  }, []);

  // Update config (no localStorage save - always starts fresh on reload)
  const handleConfigChange = useCallback((newConfig: BBDSimulatorConfig) => {
    setConfig(newConfig);
  }, []);

  // Reset all inputs to defaults
  const handleReset = useCallback(() => {
    // Reset config to defaults
    setConfig({
      ...DEFAULT_CONFIG,
      startDate: getCurrentMonth(), // Recalculate current month
    });
    // Reset BTC Held to default value
    setBtcHeld(DEFAULT_BTC_HELD);
    // Update localStorage for cross-page sharing
    if (typeof window !== 'undefined') {
      localStorage.setItem(BTC_HELD_STORAGE_KEY, DEFAULT_BTC_HELD.toString());
    }
  }, []);

  // Fetch price data and fit model
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/btc-price');
      if (!response.ok) {
        throw new Error('Failed to fetch price data');
      }
      const data: PriceDataPoint[] = await response.json();
      const parsedData = data.map(d => ({
        ...d,
        date: new Date(d.date),
      }));
      setPriceData(parsedData);

      // Fit power law model (using data from 2013 onwards)
      const startDate = new Date('2013-01-01');
      const dataForFit = parsedData.filter(d => new Date(d.date) >= startDate);
      if (dataForFit.length >= 10) {
        const newFit = fitPowerLaw(dataForFit);
        setFit(newFit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Convert price data to historical format for simulation
  const historicalData = useMemo((): HistoricalPricePoint[] => {
    return priceData.map(d => ({
      date: new Date(d.date),
      price: d.price,
    }));
  }, [priceData]);

  // Run simulation when inputs change
  const simulationResult = useMemo((): BBDSimulationResult | null => {
    if (!fit || btcHeld <= 0) return null;

    const configWithBtc = { ...config, btcHeld };
    // Parse start date from YYYY-MM format
    const [year, month] = config.startDate.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1));

    return runBBDSimulation(configWithBtc, fit, startDate, historicalData);
  }, [fit, btcHeld, config, historicalData]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded border border-gray-600 hover:border-gray-500 transition-colors"
            >
              &larr; Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-center flex-1 mx-4">
              BTC Borrow-to-Spend Simulator
            </h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded border border-gray-600 hover:border-gray-500 transition-colors"
            >
              Log out
            </button>
          </div>
          <p className="text-gray-400 text-center text-sm">
            Model borrowing against BTC to fund living expenses without selling
          </p>
        </header>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-xl text-gray-400">Loading price data...</div>
          </div>
        ) : fit ? (
          <>
            <BBDControls
              config={config}
              onConfigChange={handleConfigChange}
              btcHeld={btcHeld}
              onBtcHeldChange={handleBtcHeldChange}
              onReset={handleReset}
            />

            {btcHeld <= 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-400 text-lg">
                  Enter your BTC holdings above to run the simulation
                </p>
              </div>
            ) : (
              <>
                <BBDKpiCards result={simulationResult} />
                <BBDCharts result={simulationResult} />
                <div className="mt-6">
                  <BBDResultsTable result={simulationResult} />
                </div>
              </>
            )}

            {/* Model info footer */}
            <div className="mt-8 bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">About the Model</h3>
              <div className="text-xs text-gray-500 space-y-1">
                <p>
                  This simulator uses the Bitcoin Power Law model to project future BTC prices.
                  The model is: price = {fit.A.toExponential(2)} &times; t<sup>{fit.B.toFixed(3)}</sup> (t = days since genesis)
                </p>
                <p>
                  <strong>Scenarios:</strong> Fair = model price, +1&sigma;/-1&sigma;/-2&sigma; = model &times; exp(&plusmn;n&times;{fit.sigma.toFixed(3)})
                </p>
                <p>
                  <strong>Liquidation:</strong> When LTV (Loan/Collateral) reaches the threshold, the loan is called and collateral is sold.
                </p>
                <p className="text-orange-400">
                  <strong>Disclaimer:</strong> This is a simplified model for educational purposes only. Real-world outcomes depend on many factors not captured here.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-xl text-gray-400">Unable to load model data</div>
          </div>
        )}

        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>Based on the Power Law model | Data source: CryptoCompare + CoinGecko</p>
        </footer>
      </div>
    </div>
  );
}

export default function BBDPage() {
  return (
    <PasswordGate>
      <BBDDashboard />
    </PasswordGate>
  );
}
