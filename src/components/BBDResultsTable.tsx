'use client';

import { BBDSimulationResult, getYearlyData, formatUsd, formatLtv } from '@/lib/bbd-simulator';
import { format } from 'date-fns';

interface BBDResultsTableProps {
  result: BBDSimulationResult | null;
}

export default function BBDResultsTable({ result }: BBDResultsTableProps) {
  if (!result || result.steps.length === 0) {
    return null;
  }

  const yearlyData = getYearlyData(result.steps);

  const getLtvColor = (ltv: number, liquidationLtv: number): string => {
    const ratio = ltv / liquidationLtv;
    if (ratio >= 0.9) return 'text-red-400';
    if (ratio >= 0.7) return 'text-orange-400';
    if (ratio >= 0.5) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
      <h3 className="text-lg font-semibold text-white mb-4">Yearly Summary</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-2 text-gray-400 font-medium">Year</th>
            <th className="text-left py-3 px-2 text-gray-400 font-medium">Date</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">BTC Price</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">Collateral</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">Loan Balance</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">LTV</th>
            <th className="text-right py-3 px-2 text-gray-400 font-medium">Net Equity</th>
            <th className="text-center py-3 px-2 text-gray-400 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {yearlyData.map((step, idx) => {
            const isLiquidated = step.isLiquidated;
            const rowClass = isLiquidated ? 'bg-red-900/20' : '';
            const ltvColor = getLtvColor(step.ltv, result.config.liquidationLtvPercent / 100);

            return (
              <tr
                key={step.month}
                className={`border-b border-gray-700/50 ${rowClass} hover:bg-gray-700/30 transition-colors`}
              >
                <td className="py-3 px-2 text-white font-medium">
                  {step.month === 0 ? 'Start' : `Year ${Math.ceil(step.month / 12)}`}
                  {step.month > 0 && step.month % 12 !== 0 && (
                    <span className="text-gray-500 text-xs ml-1">
                      (+{step.month % 12}m)
                    </span>
                  )}
                </td>
                <td className="py-3 px-2 text-gray-300">
                  {format(step.date, 'MMM yyyy')}
                </td>
                <td className="py-3 px-2 text-right text-orange-400 font-mono">
                  {formatUsd(step.btcPrice)}
                </td>
                <td className="py-3 px-2 text-right text-slate-300 font-mono">
                  {formatUsd(step.collateralValue)}
                </td>
                <td className="py-3 px-2 text-right text-blue-400 font-mono">
                  {formatUsd(step.loanBalance)}
                </td>
                <td className={`py-3 px-2 text-right font-mono font-medium ${ltvColor}`}>
                  {formatLtv(step.ltv)}
                </td>
                <td className={`py-3 px-2 text-right font-mono ${
                  step.netEquity >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatUsd(step.netEquity)}
                </td>
                <td className="py-3 px-2 text-center">
                  {isLiquidated ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-900/50 text-red-300 border border-red-700">
                      Liquidated
                    </span>
                  ) : step.ltv >= (result.config.liquidationLtvPercent / 100) * 0.7 ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-900/50 text-orange-300 border border-orange-700">
                      At Risk
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-900/50 text-green-300 border border-green-700">
                      Safe
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary footer */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-400">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="block text-xs text-gray-500">Total Borrowed</span>
            <span className="text-white font-mono">{formatUsd(result.summary.totalBorrowed)}</span>
          </div>
          {result.config.interestMode === 'pay_monthly' && (
            <div>
              <span className="block text-xs text-gray-500">Total Interest Paid</span>
              <span className="text-purple-400 font-mono">{formatUsd(result.summary.totalInterestPaid)}</span>
            </div>
          )}
          <div>
            <span className="block text-xs text-gray-500">Final Status</span>
            <span className={result.summary.isLiquidated ? 'text-red-400' : 'text-green-400'}>
              {result.summary.isLiquidated
                ? `Liquidated at month ${result.summary.liquidationMonth}`
                : `Survived ${result.config.projectionYears} years`}
            </span>
          </div>
          {!result.summary.isLiquidated && (
            <div>
              <span className="block text-xs text-gray-500">Equity Growth</span>
              <span className={`font-mono ${
                (result.summary.finalNetEquity ?? 0) > result.summary.initialNetEquity
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {(result.summary.finalNetEquity ?? 0) > result.summary.initialNetEquity ? '+' : ''}
                {formatUsd((result.summary.finalNetEquity ?? 0) - result.summary.initialNetEquity)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
