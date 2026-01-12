import { PriceDataPoint, PowerLawFit, FittedDataPoint, VolatilityDataPoint, PortfolioDataPoint, PortfolioSummary } from './types';

export const BITCOIN_GENESIS_DATE = new Date('2009-01-03T00:00:00Z');

export function daysSinceGenesis(date: Date): number {
  const diffMs = date.getTime() - BITCOIN_GENESIS_DATE.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function fitPowerLaw(data: PriceDataPoint[]): PowerLawFit {
  // Filter out invalid data points (price <= 0 or daysSinceGenesis <= 0)
  const validData = data.filter(d => d.price > 0 && d.daysSinceGenesis > 0);

  if (validData.length < 2) {
    return { A: 0, B: 0, rSquared: 0, sigma: 0 };
  }

  // Transform to log-log space: log(price) = log(A) + B * log(t)
  // This is a linear regression: y = a + b*x where y = log(price), x = log(t)
  const n = validData.length;
  const logT = validData.map(d => Math.log(d.daysSinceGenesis));
  const logP = validData.map(d => Math.log(d.price));

  // Calculate means
  const meanLogT = logT.reduce((a, b) => a + b, 0) / n;
  const meanLogP = logP.reduce((a, b) => a + b, 0) / n;

  // Calculate slope (B) and intercept (log(A))
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (logT[i] - meanLogT) * (logP[i] - meanLogP);
    denominator += (logT[i] - meanLogT) ** 2;
  }

  const B = numerator / denominator;
  const logA = meanLogP - B * meanLogT;
  const A = Math.exp(logA);

  // Calculate R² and residuals
  const predictedLogP = logT.map(lt => logA + B * lt);
  const residuals = logP.map((lp, i) => lp - predictedLogP[i]);

  const ssRes = residuals.reduce((sum, r) => sum + r ** 2, 0);
  const ssTot = logP.reduce((sum, lp) => sum + (lp - meanLogP) ** 2, 0);
  const rSquared = 1 - ssRes / ssTot;

  // Calculate standard deviation of residuals in log space
  const meanResidual = residuals.reduce((a, b) => a + b, 0) / n;
  const variance = residuals.reduce((sum, r) => sum + (r - meanResidual) ** 2, 0) / (n - 1);
  const sigma = Math.sqrt(variance);

  return { A, B, rSquared, sigma };
}

export function powerLawPrice(daysSinceGenesis: number, fit: PowerLawFit): number {
  return fit.A * Math.pow(daysSinceGenesis, fit.B);
}

export function calculateDeviation(actualPrice: number, fittedPrice: number): number {
  if (fittedPrice === 0) return 0;
  return ((actualPrice - fittedPrice) / fittedPrice) * 100;
}

export function calculateSigmaDeviation(actualPrice: number, fittedPrice: number, sigma: number): number {
  if (fittedPrice <= 0 || sigma === 0) return 0;
  // Residual in log space: log(actual) - log(fitted)
  const logResidual = Math.log(actualPrice) - Math.log(fittedPrice);
  return logResidual / sigma;
}

export function applyFitToData(data: PriceDataPoint[], fit: PowerLawFit): FittedDataPoint[] {
  return data.map(d => {
    const fittedPrice = powerLawPrice(d.daysSinceGenesis, fit);
    const deviationPercent = calculateDeviation(d.price, fittedPrice);
    const sigmaDeviation = calculateSigmaDeviation(d.price, fittedPrice, fit.sigma);

    // Log residual: r(t) = log(price) - log(model)
    const logResidual = d.price > 0 && fittedPrice > 0
      ? Math.log(d.price) - Math.log(fittedPrice)
      : 0;

    // Calculate band prices: model × exp(±nσ)
    const band1SigmaUpper = fittedPrice * Math.exp(fit.sigma);
    const band1SigmaLower = fittedPrice * Math.exp(-fit.sigma);
    const band2SigmaUpper = fittedPrice * Math.exp(2 * fit.sigma);
    const band2SigmaLower = fittedPrice * Math.exp(-2 * fit.sigma);

    return {
      ...d,
      fittedPrice,
      deviationPercent,
      sigmaDeviation,
      logResidual,
      band1SigmaUpper,
      band1SigmaLower,
      band2SigmaUpper,
      band2SigmaLower,
    };
  });
}

// Rolling window size for volatility calculation (2 years = 730 days)
export const ROLLING_WINDOW_DAYS = 730;

/**
 * Calculate rolling standard deviation of log residuals
 * This represents "volatility relative to the adoption curve"
 * @param data - Array of fitted data points with log residuals
 * @param windowSize - Rolling window size in days (default: 730 for 2 years)
 * @returns Array of volatility data points
 */
export function calculateRollingVolatility(
  data: FittedDataPoint[],
  windowSize: number = ROLLING_WINDOW_DAYS
): VolatilityDataPoint[] {
  const result: VolatilityDataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    // Get the window of log residuals ending at index i
    const startIdx = Math.max(0, i - windowSize + 1);
    const windowData = data.slice(startIdx, i + 1);

    let rollingStdDev: number | null = null;

    // Need at least 2 points for standard deviation
    if (windowData.length >= 2) {
      const residuals = windowData.map(d => d.logResidual);
      const n = residuals.length;
      const mean = residuals.reduce((a, b) => a + b, 0) / n;
      const variance = residuals.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (n - 1);
      rollingStdDev = Math.sqrt(variance);
    }

    result.push({
      date: data[i].date,
      rollingStdDev,
    });
  }

  return result;
}

/**
 * Calculate portfolio data by scaling fitted data by BTC held
 * @param data - Array of fitted data points
 * @param btcHeld - Number of BTC held
 * @returns Array of portfolio data points
 */
export function calculatePortfolioData(
  data: FittedDataPoint[],
  btcHeld: number
): PortfolioDataPoint[] {
  return data.map(d => ({
    date: d.date,
    portfolioValue: btcHeld * d.price,
    portfolioFairValue: btcHeld * d.fittedPrice,
    portfolioBand1SigmaUpper: btcHeld * d.band1SigmaUpper,
    portfolioBand1SigmaLower: btcHeld * d.band1SigmaLower,
    portfolioBand2SigmaUpper: btcHeld * d.band2SigmaUpper,
    portfolioBand2SigmaLower: btcHeld * d.band2SigmaLower,
  }));
}

/**
 * Calculate portfolio summary for today's values
 * @param lastDataPoint - The most recent fitted data point
 * @param btcHeld - Number of BTC held
 * @returns Portfolio summary object
 */
export function calculatePortfolioSummary(
  lastDataPoint: FittedDataPoint,
  btcHeld: number
): PortfolioSummary {
  return {
    btcHeld,
    currentValue: btcHeld * lastDataPoint.price,
    fairValue: btcHeld * lastDataPoint.fittedPrice,
    band1SigmaUpper: btcHeld * lastDataPoint.band1SigmaUpper,
    band1SigmaLower: btcHeld * lastDataPoint.band1SigmaLower,
    band2SigmaUpper: btcHeld * lastDataPoint.band2SigmaUpper,
    band2SigmaLower: btcHeld * lastDataPoint.band2SigmaLower,
  };
}
