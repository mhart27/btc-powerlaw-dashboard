import { PowerLawFit } from './types';
import { daysSinceGenesis, powerLawPrice, BITCOIN_GENESIS_DATE } from './powerlaw';

/**
 * Scenario types for price path selection
 */
export type PriceScenario = 'fair' | 'plus1sigma' | 'plus2sigma' | 'minus1sigma' | 'minus2sigma';

/**
 * Interest handling mode
 */
export type InterestMode = 'capitalize' | 'pay_monthly';

/**
 * Borrow frequency mode
 */
export type BorrowFrequency = 'monthly' | 'yearly';

/**
 * Configuration for the BBD simulator
 */
export interface BBDSimulatorConfig {
  btcHeld: number;
  monthlySpendingUsd: number;
  interestAprPercent: number;
  liquidationLtvPercent: number;
  startingLtvPercent: number | null; // null = borrow monthly mode
  borrowMonthly: boolean;
  borrowFrequency: BorrowFrequency;
  interestMode: InterestMode;
  projectionYears: number;
  scenario: PriceScenario;
  startDate: string; // ISO date string (YYYY-MM) for simulation start
}

/**
 * Monthly simulation step result
 */
export interface BBDMonthlyStep {
  month: number;
  year: number;
  date: Date;
  btcPrice: number;
  collateralValue: number;
  loanBalance: number;
  ltv: number;
  netEquity: number;
  interestPaidThisMonth: number;
  borrowedThisMonth: number;
  isLiquidated: boolean;
  isProjection: boolean; // Whether price is from projection vs historical
}

/**
 * Complete simulation result
 */
export interface BBDSimulationResult {
  config: BBDSimulatorConfig;
  steps: BBDMonthlyStep[];
  summary: BBDSimulationSummary;
}

/**
 * Summary metrics for the simulation
 */
export interface BBDSimulationSummary {
  initialCollateralValue: number;
  finalCollateralValue: number | null;
  initialLoanBalance: number;
  finalLoanBalance: number | null;
  initialLtv: number;
  finalLtv: number | null;
  initialNetEquity: number;
  finalNetEquity: number | null;
  totalInterestPaid: number;
  totalBorrowed: number;
  isLiquidated: boolean;
  liquidationMonth: number | null;
  monthsUntilLiquidation: number | null;
}

/**
 * Get the price for a given date based on the power law model and scenario
 */
export function getScenarioPrice(
  date: Date,
  fit: PowerLawFit,
  scenario: PriceScenario
): number {
  const days = daysSinceGenesis(date);
  const fittedPrice = powerLawPrice(days, fit);

  switch (scenario) {
    case 'fair':
      return fittedPrice;
    case 'plus1sigma':
      return fittedPrice * Math.exp(fit.sigma);
    case 'plus2sigma':
      return fittedPrice * Math.exp(2 * fit.sigma);
    case 'minus1sigma':
      return fittedPrice * Math.exp(-fit.sigma);
    case 'minus2sigma':
      return fittedPrice * Math.exp(-2 * fit.sigma);
  }
}

/**
 * Generate a price path for the simulation period
 * Returns monthly prices starting from startDate
 */
export function generatePricePath(
  startDate: Date,
  projectionYears: number,
  fit: PowerLawFit,
  scenario: PriceScenario
): { date: Date; price: number; isProjection: boolean }[] {
  const path: { date: Date; price: number; isProjection: boolean }[] = [];
  const totalMonths = projectionYears * 12;

  for (let month = 0; month <= totalMonths; month++) {
    // Use the first of each month to avoid date drift issues
    const date = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + month,
      1
    ));
    const price = getScenarioPrice(date, fit, scenario);
    path.push({ date, price, isProjection: true });
  }

  return path;
}

/**
 * Historical price data point for simulation
 */
export interface HistoricalPricePoint {
  date: Date;
  price: number;
}

/**
 * Generate a price path that uses historical data when available
 * For dates before today: use historical prices if available
 * For dates after today: use projected model prices based on scenario
 */
export function generateMixedPricePath(
  startDate: Date,
  projectionYears: number,
  fit: PowerLawFit,
  scenario: PriceScenario,
  historicalData: HistoricalPricePoint[]
): { date: Date; price: number; isProjection: boolean }[] {
  const path: { date: Date; price: number; isProjection: boolean }[] = [];
  const totalMonths = projectionYears * 12;
  const today = new Date();
  const todayMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  // Create a map of historical prices by month (YYYY-MM format)
  const historicalMap = new Map<string, number>();
  for (const point of historicalData) {
    const key = `${point.date.getUTCFullYear()}-${String(point.date.getUTCMonth() + 1).padStart(2, '0')}`;
    // Use the last price for each month
    historicalMap.set(key, point.price);
  }

  for (let month = 0; month <= totalMonths; month++) {
    const date = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + month,
      1
    ));
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

    // Use historical price if date is before or equal to today and we have data
    const isBeforeOrToday = date <= todayMonth;
    const historicalPrice = historicalMap.get(dateKey);

    if (isBeforeOrToday && historicalPrice !== undefined) {
      path.push({ date, price: historicalPrice, isProjection: false });
    } else {
      // Use projected price based on scenario
      const price = getScenarioPrice(date, fit, scenario);
      path.push({ date, price, isProjection: true });
    }
  }

  return path;
}

/**
 * Run the BBD simulation
 *
 * The simulation models borrowing against BTC collateral to fund spending.
 * Each month:
 * 1. Calculate collateral value at current BTC price
 * 2. If borrow monthly mode: increase loan by monthly spending
 * 3. Apply interest (capitalize or pay monthly)
 * 4. Calculate LTV and check for liquidation
 *
 * @param config - Simulation configuration
 * @param fit - Power law fit parameters
 * @param startDate - Start date for simulation
 * @param historicalData - Optional historical price data for dates before today
 */
export function runBBDSimulation(
  config: BBDSimulatorConfig,
  fit: PowerLawFit,
  startDate: Date,
  historicalData?: HistoricalPricePoint[]
): BBDSimulationResult {
  const pricePath = historicalData && historicalData.length > 0
    ? generateMixedPricePath(startDate, config.projectionYears, fit, config.scenario, historicalData)
    : generatePricePath(startDate, config.projectionYears, fit, config.scenario);
  const steps: BBDMonthlyStep[] = [];

  const monthlyInterestRate = config.interestAprPercent / 100 / 12;
  const liquidationLtv = config.liquidationLtvPercent / 100;

  // Initialize loan balance
  let loanBalance = 0;
  let totalInterestPaid = 0;
  let totalBorrowed = 0;
  let isLiquidated = false;
  let liquidationMonth: number | null = null;

  // If starting LTV mode, calculate initial loan
  if (!config.borrowMonthly && config.startingLtvPercent !== null) {
    const initialPrice = pricePath[0].price;
    const initialCollateralValue = config.btcHeld * initialPrice;
    const startingLtv = config.startingLtvPercent / 100;
    loanBalance = initialCollateralValue * startingLtv;
    totalBorrowed = loanBalance;
  }

  for (let i = 0; i < pricePath.length; i++) {
    const { date, price, isProjection } = pricePath[i];
    const month = i;
    const year = Math.floor(i / 12);

    let borrowedThisMonth = 0;
    let interestPaidThisMonth = 0;

    // Calculate collateral value
    const collateralValue = config.btcHeld * price;

    // If borrow mode is enabled, borrow based on frequency
    if (config.borrowMonthly && i > 0) {
      if (config.borrowFrequency === 'monthly') {
        // Monthly: borrow monthly spending each month
        loanBalance += config.monthlySpendingUsd;
        borrowedThisMonth = config.monthlySpendingUsd;
        totalBorrowed += config.monthlySpendingUsd;
      } else if (config.borrowFrequency === 'yearly') {
        // Yearly: borrow 12x monthly spending once per year (at months 12, 24, 36, ...)
        if (i % 12 === 0) {
          const yearlyAmount = config.monthlySpendingUsd * 12;
          loanBalance += yearlyAmount;
          borrowedThisMonth = yearlyAmount;
          totalBorrowed += yearlyAmount;
        }
      }
    }

    // Apply interest (skip first month - no interest accrued yet)
    if (i > 0) {
      const interestAmount = loanBalance * monthlyInterestRate;
      if (config.interestMode === 'capitalize') {
        loanBalance += interestAmount;
      } else {
        // Pay monthly - track as paid but don't add to balance
        interestPaidThisMonth = interestAmount;
        totalInterestPaid += interestAmount;
      }
    }

    // Calculate LTV
    const ltv = collateralValue > 0 ? loanBalance / collateralValue : 0;

    // Calculate net equity
    const netEquity = collateralValue - loanBalance;

    // Check for liquidation
    if (ltv >= liquidationLtv && !isLiquidated) {
      isLiquidated = true;
      liquidationMonth = month;
    }

    steps.push({
      month,
      year,
      date,
      btcPrice: price,
      collateralValue,
      loanBalance,
      ltv,
      netEquity,
      interestPaidThisMonth,
      borrowedThisMonth,
      isLiquidated,
      isProjection,
    });

    // Stop simulation after liquidation
    if (isLiquidated) {
      break;
    }
  }

  // Calculate summary
  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];

  const summary: BBDSimulationSummary = {
    initialCollateralValue: firstStep.collateralValue,
    finalCollateralValue: isLiquidated ? null : lastStep.collateralValue,
    initialLoanBalance: firstStep.loanBalance,
    finalLoanBalance: isLiquidated ? null : lastStep.loanBalance,
    initialLtv: firstStep.ltv,
    finalLtv: isLiquidated ? null : lastStep.ltv,
    initialNetEquity: firstStep.netEquity,
    finalNetEquity: isLiquidated ? null : lastStep.netEquity,
    totalInterestPaid,
    totalBorrowed,
    isLiquidated,
    liquidationMonth,
    monthsUntilLiquidation: liquidationMonth,
  };

  return { config, steps, summary };
}

/**
 * Get yearly summary data from simulation steps
 * Extracts data at 12-month intervals (end of each year)
 */
export function getYearlyData(steps: BBDMonthlyStep[]): BBDMonthlyStep[] {
  const yearlyData: BBDMonthlyStep[] = [];

  // Always include month 0 (start)
  if (steps.length > 0) {
    yearlyData.push(steps[0]);
  }

  // Include end of each year (month 12, 24, 36, ...)
  for (let i = 12; i < steps.length; i += 12) {
    yearlyData.push(steps[i]);
  }

  // Include final step if not already included and simulation ended early
  const lastStep = steps[steps.length - 1];
  if (lastStep.month % 12 !== 0 && lastStep.month !== 0) {
    yearlyData.push(lastStep);
  }

  return yearlyData;
}

/**
 * Format USD amount with appropriate precision
 */
export function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Format LTV as percentage
 */
export function formatLtv(ltv: number): string {
  return `${(ltv * 100).toFixed(1)}%`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Get scenario display label
 */
export function getScenarioLabel(scenario: PriceScenario): string {
  switch (scenario) {
    case 'fair':
      return 'Fair Value';
    case 'plus1sigma':
      return '+1σ (Optimistic)';
    case 'plus2sigma':
      return '+2σ (Mania)';
    case 'minus1sigma':
      return '-1σ (Pessimistic)';
    case 'minus2sigma':
      return '-2σ (Deep Bear)';
  }
}
