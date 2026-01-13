'use client';

import { BBDSimulationResult, formatUsd, formatLtv } from '@/lib/bbd-simulator';

interface BBDKpiCardsProps {
  result: BBDSimulationResult | null;
}

export default function BBDKpiCards({ result }: BBDKpiCardsProps) {
  if (!result || result.steps.length === 0) {
    return null;
  }

  const { summary, steps } = result;
  const currentStep = steps[steps.length - 1];
  const firstStep = steps[0];

  // Calculate months until liquidation from now (current position in simulation)
  const monthsUntilLiquidation = summary.isLiquidated
    ? summary.liquidationMonth
    : null;

  const getLtvColor = (ltv: number, liquidationLtv: number): string => {
    const ratio = ltv / liquidationLtv;
    if (ratio >= 0.9) return 'text-red-400';
    if (ratio >= 0.7) return 'text-orange-400';
    if (ratio >= 0.5) return 'text-yellow-400';
    return 'text-green-400';
  };

  const ltvColor = getLtvColor(currentStep.ltv, result.config.liquidationLtvPercent / 100);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Collateral Value */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-1">Collateral Value</div>
        <div className="text-2xl font-bold text-orange-400">
          {formatUsd(currentStep.collateralValue)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {result.config.btcHeld.toFixed(4)} BTC @ {formatUsd(currentStep.btcPrice)}
        </div>
      </div>

      {/* Loan Balance */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-1">Loan Balance</div>
        <div className="text-2xl font-bold text-blue-400">
          {formatUsd(currentStep.loanBalance)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Total borrowed: {formatUsd(summary.totalBorrowed)}
        </div>
      </div>

      {/* Current LTV */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-1">Current LTV</div>
        <div className={`text-2xl font-bold ${ltvColor}`}>
          {formatLtv(currentStep.ltv)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Liquidation at {result.config.liquidationLtvPercent}%
        </div>
        {/* LTV progress bar */}
        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              currentStep.ltv >= result.config.liquidationLtvPercent / 100
                ? 'bg-red-500'
                : currentStep.ltv >= (result.config.liquidationLtvPercent / 100) * 0.7
                ? 'bg-orange-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, (currentStep.ltv / (result.config.liquidationLtvPercent / 100)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Liquidation Status / Months Until */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-1">Liquidation Status</div>
        {summary.isLiquidated ? (
          <>
            <div className="text-2xl font-bold text-red-400">
              Liquidated
            </div>
            <div className="text-xs text-gray-500 mt-1">
              At month {monthsUntilLiquidation} ({Math.floor((monthsUntilLiquidation ?? 0) / 12)}y {(monthsUntilLiquidation ?? 0) % 12}m)
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold text-green-400">
              Safe
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Survived {result.config.projectionYears} year projection
            </div>
          </>
        )}
      </div>

      {/* Net Equity */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-1">Net Equity</div>
        <div className={`text-2xl font-bold ${currentStep.netEquity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatUsd(currentStep.netEquity)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Collateral - Loan
        </div>
      </div>

      {/* Starting vs Current Comparison */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-1">Equity Growth</div>
        <div className={`text-2xl font-bold ${
          currentStep.netEquity > firstStep.netEquity ? 'text-green-400' : 'text-red-400'
        }`}>
          {currentStep.netEquity > firstStep.netEquity ? '+' : ''}
          {formatUsd(currentStep.netEquity - firstStep.netEquity)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          From {formatUsd(firstStep.netEquity)}
        </div>
      </div>

      {/* Interest Paid (for pay_monthly mode) */}
      {result.config.interestMode === 'pay_monthly' && (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Total Interest Paid</div>
          <div className="text-2xl font-bold text-purple-400">
            {formatUsd(summary.totalInterestPaid)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Over {steps.length - 1} months
          </div>
        </div>
      )}

      {/* Simulation Duration */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-1">Simulation Duration</div>
        <div className="text-2xl font-bold text-slate-300">
          {Math.floor((steps.length - 1) / 12)}y {(steps.length - 1) % 12}m
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {steps.length - 1} months total
        </div>
      </div>
    </div>
  );
}
