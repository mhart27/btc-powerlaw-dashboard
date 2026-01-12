export interface PriceDataPoint {
  date: Date;
  timestamp: number;
  price: number;
  daysSinceGenesis: number;
}

export interface PowerLawFit {
  A: number;
  B: number;
  rSquared: number;
  sigma: number; // Standard deviation of log residuals
}

export interface FittedDataPoint extends PriceDataPoint {
  fittedPrice: number;
  deviationPercent: number;
  sigmaDeviation: number; // Deviation in sigma units (log space)
  logResidual: number; // Raw log residual: log(price) - log(model)
  // Band prices
  band1SigmaUpper: number;
  band1SigmaLower: number;
  band2SigmaUpper: number;
  band2SigmaLower: number;
}

export interface VolatilityDataPoint {
  date: Date;
  rollingStdDev: number | null; // Rolling 2-year std dev of log residuals
}

export interface ChartData {
  dataPoints: FittedDataPoint[];
  fit: PowerLawFit;
}

export type ValuationZone = 'deep-value' | 'undervalued' | 'fair' | 'overvalued' | 'bubble';

export function getValuationZone(sigmaDeviation: number): ValuationZone {
  if (sigmaDeviation <= -2) return 'deep-value';
  if (sigmaDeviation <= -1) return 'undervalued';
  if (sigmaDeviation <= 1) return 'fair';
  if (sigmaDeviation <= 2) return 'overvalued';
  return 'bubble';
}

export function getValuationLabel(zone: ValuationZone): string {
  switch (zone) {
    case 'deep-value': return 'Deep Value';
    case 'undervalued': return 'Undervalued';
    case 'fair': return 'Fair Value';
    case 'overvalued': return 'Expensive';
    case 'bubble': return 'Bubble';
  }
}

export interface PortfolioDataPoint {
  date: Date;
  portfolioValue: number;      // btcHeld * price
  portfolioFairValue: number;  // btcHeld * fittedPrice
  portfolioBand1SigmaUpper: number;
  portfolioBand1SigmaLower: number;
  portfolioBand2SigmaUpper: number;
  portfolioBand2SigmaLower: number;
}

export interface PortfolioSummary {
  btcHeld: number;
  currentValue: number;
  fairValue: number;
  band1SigmaUpper: number;
  band1SigmaLower: number;
  band2SigmaUpper: number;
  band2SigmaLower: number;
}
