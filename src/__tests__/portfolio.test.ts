import {
  calculatePortfolioData,
  calculatePortfolioSummary,
} from '../lib/powerlaw';
import { FittedDataPoint } from '../lib/types';

// Helper to create a fitted data point
function createFittedDataPoint(overrides: Partial<FittedDataPoint> = {}): FittedDataPoint {
  return {
    date: new Date('2024-01-01'),
    timestamp: Date.now(),
    price: 50000,
    daysSinceGenesis: 5000,
    fittedPrice: 45000,
    deviationPercent: 11.11,
    sigmaDeviation: 0.5,
    logResidual: 0.1,
    band1SigmaUpper: 60000,
    band1SigmaLower: 33750,
    band2SigmaUpper: 80000,
    band2SigmaLower: 25312.5,
    ...overrides,
  };
}

describe('calculatePortfolioData', () => {
  it('should return empty array for empty input', () => {
    const result = calculatePortfolioData([], 1);
    expect(result).toEqual([]);
  });

  it('should return empty array when btcHeld is 0', () => {
    const data = [createFittedDataPoint()];
    const result = calculatePortfolioData(data, 0);
    expect(result).toHaveLength(1);
    // All values should be 0 when btcHeld is 0
    expect(result[0].portfolioValue).toBe(0);
    expect(result[0].portfolioFairValue).toBe(0);
  });

  it('should scale all values by btcHeld', () => {
    const btcHeld = 2.5;
    const data = [createFittedDataPoint({
      price: 50000,
      fittedPrice: 45000,
      band1SigmaUpper: 60000,
      band1SigmaLower: 33750,
      band2SigmaUpper: 80000,
      band2SigmaLower: 25312.5,
    })];

    const result = calculatePortfolioData(data, btcHeld);

    expect(result).toHaveLength(1);
    expect(result[0].portfolioValue).toBe(50000 * btcHeld);
    expect(result[0].portfolioFairValue).toBe(45000 * btcHeld);
    expect(result[0].portfolioBand1SigmaUpper).toBe(60000 * btcHeld);
    expect(result[0].portfolioBand1SigmaLower).toBe(33750 * btcHeld);
    expect(result[0].portfolioBand2SigmaUpper).toBe(80000 * btcHeld);
    expect(result[0].portfolioBand2SigmaLower).toBe(25312.5 * btcHeld);
  });

  it('should preserve dates from input', () => {
    const testDate = new Date('2023-06-15');
    const data = [createFittedDataPoint({ date: testDate })];
    const result = calculatePortfolioData(data, 1);

    expect(result[0].date).toEqual(testDate);
  });

  it('should handle multiple data points', () => {
    const btcHeld = 1.5;
    const data = [
      createFittedDataPoint({ price: 40000, fittedPrice: 35000 }),
      createFittedDataPoint({ price: 50000, fittedPrice: 45000 }),
      createFittedDataPoint({ price: 60000, fittedPrice: 55000 }),
    ];

    const result = calculatePortfolioData(data, btcHeld);

    expect(result).toHaveLength(3);
    expect(result[0].portfolioValue).toBe(40000 * btcHeld);
    expect(result[1].portfolioValue).toBe(50000 * btcHeld);
    expect(result[2].portfolioValue).toBe(60000 * btcHeld);
    expect(result[0].portfolioFairValue).toBe(35000 * btcHeld);
    expect(result[1].portfolioFairValue).toBe(45000 * btcHeld);
    expect(result[2].portfolioFairValue).toBe(55000 * btcHeld);
  });

  it('should handle fractional btcHeld', () => {
    const btcHeld = 0.001;
    const data = [createFittedDataPoint({ price: 100000 })];

    const result = calculatePortfolioData(data, btcHeld);

    expect(result[0].portfolioValue).toBeCloseTo(100, 5);
  });

  it('should handle large btcHeld values', () => {
    const btcHeld = 1000;
    const data = [createFittedDataPoint({ price: 50000 })];

    const result = calculatePortfolioData(data, btcHeld);

    expect(result[0].portfolioValue).toBe(50000000);
  });
});

describe('calculatePortfolioSummary', () => {
  it('should return correct summary for given data point and btcHeld', () => {
    const btcHeld = 2;
    const dataPoint = createFittedDataPoint({
      price: 50000,
      fittedPrice: 45000,
      band1SigmaUpper: 60000,
      band1SigmaLower: 33750,
      band2SigmaUpper: 80000,
      band2SigmaLower: 25312.5,
    });

    const result = calculatePortfolioSummary(dataPoint, btcHeld);

    expect(result.btcHeld).toBe(btcHeld);
    expect(result.currentValue).toBe(100000);
    expect(result.fairValue).toBe(90000);
    expect(result.band1SigmaUpper).toBe(120000);
    expect(result.band1SigmaLower).toBe(67500);
    expect(result.band2SigmaUpper).toBe(160000);
    expect(result.band2SigmaLower).toBe(50625);
  });

  it('should return zeros when btcHeld is 0', () => {
    const dataPoint = createFittedDataPoint();
    const result = calculatePortfolioSummary(dataPoint, 0);

    expect(result.btcHeld).toBe(0);
    expect(result.currentValue).toBe(0);
    expect(result.fairValue).toBe(0);
    expect(result.band1SigmaUpper).toBe(0);
    expect(result.band1SigmaLower).toBe(0);
    expect(result.band2SigmaUpper).toBe(0);
    expect(result.band2SigmaLower).toBe(0);
  });

  it('should handle fractional btcHeld', () => {
    const btcHeld = 0.5;
    const dataPoint = createFittedDataPoint({
      price: 100000,
      fittedPrice: 90000,
    });

    const result = calculatePortfolioSummary(dataPoint, btcHeld);

    expect(result.currentValue).toBe(50000);
    expect(result.fairValue).toBe(45000);
  });

  it('should maintain band relationships after scaling', () => {
    const btcHeld = 3;
    const dataPoint = createFittedDataPoint({
      fittedPrice: 50000,
      band1SigmaUpper: 65000,
      band1SigmaLower: 38500,
      band2SigmaUpper: 84500,
      band2SigmaLower: 29575,
    });

    const result = calculatePortfolioSummary(dataPoint, btcHeld);

    // Verify ordering is preserved
    expect(result.band2SigmaLower).toBeLessThan(result.band1SigmaLower);
    expect(result.band1SigmaLower).toBeLessThan(result.fairValue);
    expect(result.fairValue).toBeLessThan(result.band1SigmaUpper);
    expect(result.band1SigmaUpper).toBeLessThan(result.band2SigmaUpper);
  });
});

describe('Portfolio calculations with realistic BTC data', () => {
  it('should calculate correct portfolio for typical holding', () => {
    const btcHeld = 0.1; // 0.1 BTC
    const currentPrice = 95000;
    const fairPrice = 85000;

    const dataPoint = createFittedDataPoint({
      price: currentPrice,
      fittedPrice: fairPrice,
      band1SigmaUpper: fairPrice * 1.5,
      band1SigmaLower: fairPrice * 0.67,
      band2SigmaUpper: fairPrice * 2.25,
      band2SigmaLower: fairPrice * 0.44,
    });

    const summary = calculatePortfolioSummary(dataPoint, btcHeld);

    // With 0.1 BTC at $95,000, portfolio should be $9,500
    expect(summary.currentValue).toBe(9500);
    // Fair value at $85,000 = $8,500
    expect(summary.fairValue).toBe(8500);
  });

  it('should correctly scale bands for whale holdings', () => {
    const btcHeld = 100;
    const fairPrice = 50000;

    const dataPoint = createFittedDataPoint({
      price: 55000,
      fittedPrice: fairPrice,
      band1SigmaUpper: 65000,
      band1SigmaLower: 37000,
      band2SigmaUpper: 85000,
      band2SigmaLower: 28000,
    });

    const summary = calculatePortfolioSummary(dataPoint, btcHeld);

    // Verify large-scale calculations
    expect(summary.currentValue).toBe(5500000); // $5.5M
    expect(summary.fairValue).toBe(5000000); // $5M
    expect(summary.band2SigmaUpper).toBe(8500000); // $8.5M
    expect(summary.band2SigmaLower).toBe(2800000); // $2.8M
  });
});
