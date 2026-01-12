import {
  daysSinceGenesis,
  fitPowerLaw,
  powerLawPrice,
  calculateDeviation,
  calculateSigmaDeviation,
  applyFitToData,
  calculateRollingVolatility,
  BITCOIN_GENESIS_DATE,
  ROLLING_WINDOW_DAYS,
} from '../lib/powerlaw';
import { PriceDataPoint, FittedDataPoint } from '../lib/types';

describe('daysSinceGenesis', () => {
  it('should return 0 for the genesis date', () => {
    const result = daysSinceGenesis(BITCOIN_GENESIS_DATE);
    expect(result).toBe(0);
  });

  it('should return correct days for a known date', () => {
    // January 3, 2010 is exactly 365 days after genesis
    const oneYearLater = new Date('2010-01-03T00:00:00Z');
    const result = daysSinceGenesis(oneYearLater);
    expect(result).toBe(365);
  });

  it('should return correct days for 2013-01-01', () => {
    const date = new Date('2013-01-01T00:00:00Z');
    const result = daysSinceGenesis(date);
    // From Jan 3 2009 to Jan 1 2013:
    // Rest of 2009: 363 days (Jan 3 to Dec 31), 2010: 365, 2011: 365, 2012: 366 (leap year)
    // = 363 + 365 + 365 + 366 = 1459
    expect(result).toBe(1459);
  });
});

describe('fitPowerLaw', () => {
  it('should fit a perfect power law with high R² and zero sigma', () => {
    // Create synthetic data that follows price = 10 * t^2 exactly
    const A = 10;
    const B = 2;
    const data: PriceDataPoint[] = [];

    for (let t = 100; t <= 1000; t += 100) {
      const price = A * Math.pow(t, B);
      data.push({
        date: new Date(),
        timestamp: Date.now(),
        price,
        daysSinceGenesis: t,
      });
    }

    const fit = fitPowerLaw(data);

    // Should recover the original parameters closely
    expect(fit.A).toBeCloseTo(A, 1);
    expect(fit.B).toBeCloseTo(B, 3);
    expect(fit.rSquared).toBeGreaterThan(0.999);
    // Perfect fit should have near-zero sigma
    expect(fit.sigma).toBeLessThan(0.001);
  });

  it('should handle noisy data with reasonable R² and positive sigma', () => {
    // Create synthetic data with some noise
    const A = 0.001;
    const B = 5.5;
    const data: PriceDataPoint[] = [];

    // Use seeded random for reproducibility
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let t = 100; t <= 2000; t += 50) {
      // Add ±10% noise
      const noise = 0.9 + random() * 0.2;
      const price = A * Math.pow(t, B) * noise;
      data.push({
        date: new Date(),
        timestamp: Date.now(),
        price,
        daysSinceGenesis: t,
      });
    }

    const fit = fitPowerLaw(data);

    // Should be close to original parameters
    expect(fit.B).toBeGreaterThan(B - 0.5);
    expect(fit.B).toBeLessThan(B + 0.5);
    expect(fit.rSquared).toBeGreaterThan(0.9);
    // Noisy data should have positive sigma
    expect(fit.sigma).toBeGreaterThan(0);
  });

  it('should return zeros for insufficient data', () => {
    const data: PriceDataPoint[] = [
      { date: new Date(), timestamp: Date.now(), price: 100, daysSinceGenesis: 1000 },
    ];

    const fit = fitPowerLaw(data);

    expect(fit.A).toBe(0);
    expect(fit.B).toBe(0);
    expect(fit.rSquared).toBe(0);
    expect(fit.sigma).toBe(0);
  });

  it('should filter out invalid data points', () => {
    const data: PriceDataPoint[] = [
      { date: new Date(), timestamp: Date.now(), price: 0, daysSinceGenesis: 100 },
      { date: new Date(), timestamp: Date.now(), price: -10, daysSinceGenesis: 200 },
      { date: new Date(), timestamp: Date.now(), price: 100, daysSinceGenesis: 0 },
      { date: new Date(), timestamp: Date.now(), price: 100, daysSinceGenesis: 300 },
      { date: new Date(), timestamp: Date.now(), price: 900, daysSinceGenesis: 600 },
      { date: new Date(), timestamp: Date.now(), price: 2700, daysSinceGenesis: 900 },
    ];

    const fit = fitPowerLaw(data);

    // Should still produce a valid fit from the valid points
    expect(fit.A).toBeGreaterThan(0);
    expect(fit.rSquared).toBeGreaterThan(0);
    expect(fit.sigma).toBeGreaterThanOrEqual(0);
  });
});

describe('powerLawPrice', () => {
  it('should calculate correct price for given parameters', () => {
    const fit = { A: 10, B: 2, rSquared: 1, sigma: 0.5 };

    expect(powerLawPrice(100, fit)).toBeCloseTo(100000, 0);
    expect(powerLawPrice(50, fit)).toBeCloseTo(25000, 0);
  });

  it('should handle fractional exponents', () => {
    const fit = { A: 1, B: 0.5, rSquared: 1, sigma: 0.5 };

    expect(powerLawPrice(100, fit)).toBeCloseTo(10, 5);
    expect(powerLawPrice(4, fit)).toBeCloseTo(2, 5);
  });
});

describe('calculateDeviation', () => {
  it('should return 0% when actual equals fitted', () => {
    expect(calculateDeviation(100, 100)).toBe(0);
  });

  it('should return positive percentage when actual is higher', () => {
    expect(calculateDeviation(150, 100)).toBe(50);
  });

  it('should return negative percentage when actual is lower', () => {
    expect(calculateDeviation(50, 100)).toBe(-50);
  });

  it('should handle edge case of zero fitted price', () => {
    expect(calculateDeviation(100, 0)).toBe(0);
  });

  it('should calculate correct large deviations', () => {
    expect(calculateDeviation(1000, 100)).toBe(900);
    expect(calculateDeviation(10, 100)).toBe(-90);
  });
});

describe('calculateSigmaDeviation', () => {
  it('should return 0 when actual equals fitted', () => {
    expect(calculateSigmaDeviation(100, 100, 0.5)).toBeCloseTo(0, 5);
  });

  it('should return positive sigma when actual is higher', () => {
    // If actual = fitted * exp(sigma), deviation should be +1 sigma
    const sigma = 0.5;
    const fitted = 100;
    const actual = fitted * Math.exp(sigma);
    expect(calculateSigmaDeviation(actual, fitted, sigma)).toBeCloseTo(1, 5);
  });

  it('should return negative sigma when actual is lower', () => {
    // If actual = fitted * exp(-sigma), deviation should be -1 sigma
    const sigma = 0.5;
    const fitted = 100;
    const actual = fitted * Math.exp(-sigma);
    expect(calculateSigmaDeviation(actual, fitted, sigma)).toBeCloseTo(-1, 5);
  });

  it('should return 0 for zero sigma', () => {
    expect(calculateSigmaDeviation(150, 100, 0)).toBe(0);
  });

  it('should return 0 for zero fitted price', () => {
    expect(calculateSigmaDeviation(100, 0, 0.5)).toBe(0);
  });

  it('should calculate correct 2-sigma deviation', () => {
    const sigma = 0.5;
    const fitted = 100;
    const actual = fitted * Math.exp(2 * sigma);
    expect(calculateSigmaDeviation(actual, fitted, sigma)).toBeCloseTo(2, 5);
  });
});

describe('applyFitToData', () => {
  it('should add fitted price, deviation, and bands to each data point', () => {
    const fit = { A: 1, B: 2, rSquared: 0.99, sigma: 0.5 };
    const data: PriceDataPoint[] = [
      { date: new Date(), timestamp: Date.now(), price: 10000, daysSinceGenesis: 100 },
      { date: new Date(), timestamp: Date.now(), price: 40000, daysSinceGenesis: 200 },
    ];

    const result = applyFitToData(data, fit);

    expect(result).toHaveLength(2);

    // First point: fitted = 1 * 100^2 = 10000, deviation = 0%
    expect(result[0].fittedPrice).toBeCloseTo(10000, 0);
    expect(result[0].deviationPercent).toBeCloseTo(0, 5);
    expect(result[0].sigmaDeviation).toBeCloseTo(0, 5);

    // Check bands exist and are correctly ordered
    expect(result[0].band2SigmaLower).toBeLessThan(result[0].band1SigmaLower);
    expect(result[0].band1SigmaLower).toBeLessThan(result[0].fittedPrice);
    expect(result[0].fittedPrice).toBeLessThan(result[0].band1SigmaUpper);
    expect(result[0].band1SigmaUpper).toBeLessThan(result[0].band2SigmaUpper);

    // Second point: fitted = 1 * 200^2 = 40000, deviation = 0%
    expect(result[1].fittedPrice).toBeCloseTo(40000, 0);
    expect(result[1].deviationPercent).toBeCloseTo(0, 5);
  });

  it('should calculate correct band values', () => {
    const sigma = 0.5;
    const fit = { A: 1, B: 2, rSquared: 0.99, sigma };
    const data: PriceDataPoint[] = [
      { date: new Date(), timestamp: Date.now(), price: 10000, daysSinceGenesis: 100 },
    ];

    const result = applyFitToData(data, fit);
    const fittedPrice = 10000; // 1 * 100^2

    // Band prices should be: fitted * exp(±n*sigma)
    expect(result[0].band1SigmaUpper).toBeCloseTo(fittedPrice * Math.exp(sigma), 0);
    expect(result[0].band1SigmaLower).toBeCloseTo(fittedPrice * Math.exp(-sigma), 0);
    expect(result[0].band2SigmaUpper).toBeCloseTo(fittedPrice * Math.exp(2 * sigma), 0);
    expect(result[0].band2SigmaLower).toBeCloseTo(fittedPrice * Math.exp(-2 * sigma), 0);
  });

  it('should preserve original data properties', () => {
    const fit = { A: 1, B: 2, rSquared: 0.99, sigma: 0.5 };
    const originalDate = new Date('2020-01-01');
    const data: PriceDataPoint[] = [
      { date: originalDate, timestamp: 1577836800000, price: 10000, daysSinceGenesis: 100 },
    ];

    const result = applyFitToData(data, fit);

    expect(result[0].date).toEqual(originalDate);
    expect(result[0].timestamp).toBe(1577836800000);
    expect(result[0].price).toBe(10000);
    expect(result[0].daysSinceGenesis).toBe(100);
  });

  it('should include logResidual in output', () => {
    const fit = { A: 1, B: 2, rSquared: 0.99, sigma: 0.5 };
    const data: PriceDataPoint[] = [
      { date: new Date(), timestamp: Date.now(), price: 10000, daysSinceGenesis: 100 },
      { date: new Date(), timestamp: Date.now(), price: 80000, daysSinceGenesis: 200 }, // 2x expected
    ];

    const result = applyFitToData(data, fit);

    // First point: price = fitted, logResidual = 0
    expect(result[0].logResidual).toBeCloseTo(0, 5);

    // Second point: fitted = 40000, actual = 80000, logResidual = ln(80000/40000) = ln(2)
    expect(result[1].logResidual).toBeCloseTo(Math.log(2), 5);
  });
});

describe('ROLLING_WINDOW_DAYS', () => {
  it('should be 730 days (2 years)', () => {
    expect(ROLLING_WINDOW_DAYS).toBe(730);
  });
});

describe('calculateRollingVolatility', () => {
  // Helper to create fitted data with specific log residuals
  function createFittedDataWithResiduals(residuals: number[]): FittedDataPoint[] {
    return residuals.map((logResidual, i) => ({
      date: new Date(2020, 0, i + 1), // Sequential dates starting Jan 1 2020
      timestamp: Date.now(),
      price: 10000,
      daysSinceGenesis: 4000 + i,
      fittedPrice: 10000,
      deviationPercent: 0,
      sigmaDeviation: 0,
      logResidual,
      band1SigmaUpper: 10000,
      band1SigmaLower: 10000,
      band2SigmaUpper: 10000,
      band2SigmaLower: 10000,
    }));
  }

  it('should return empty array for empty input', () => {
    const result = calculateRollingVolatility([]);
    expect(result).toEqual([]);
  });

  it('should return null stdDev for single data point', () => {
    const data = createFittedDataWithResiduals([0.1]);
    const result = calculateRollingVolatility(data);
    expect(result).toHaveLength(1);
    expect(result[0].rollingStdDev).toBeNull();
  });

  it('should calculate std dev starting from 2 points', () => {
    const data = createFittedDataWithResiduals([0.1, 0.2]);
    const result = calculateRollingVolatility(data, 730);

    expect(result).toHaveLength(2);
    expect(result[0].rollingStdDev).toBeNull(); // Only 1 point
    expect(result[1].rollingStdDev).not.toBeNull(); // 2 points

    // Manual calculation: mean = 0.15, variance = ((0.1-0.15)^2 + (0.2-0.15)^2) / 1 = 0.005
    // stdDev = sqrt(0.005) ≈ 0.0707
    expect(result[1].rollingStdDev).toBeCloseTo(0.0707, 3);
  });

  it('should use correct window size', () => {
    // Create 10 data points
    const residuals = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const data = createFittedDataWithResiduals(residuals);

    // Use window size of 5
    const result = calculateRollingVolatility(data, 5);

    expect(result).toHaveLength(10);

    // For index 4 (5th point), window is [0.1, 0.2, 0.3, 0.4, 0.5]
    // mean = 0.3, variance = sum((x-0.3)^2) / 4
    const window5 = [0.1, 0.2, 0.3, 0.4, 0.5];
    const mean5 = 0.3;
    const variance5 = window5.reduce((sum, x) => sum + (x - mean5) ** 2, 0) / 4;
    const std5 = Math.sqrt(variance5);
    expect(result[4].rollingStdDev).toBeCloseTo(std5, 5);

    // For index 9 (10th point), window is [0.6, 0.7, 0.8, 0.9, 1.0]
    const window10 = [0.6, 0.7, 0.8, 0.9, 1.0];
    const mean10 = 0.8;
    const variance10 = window10.reduce((sum, x) => sum + (x - mean10) ** 2, 0) / 4;
    const std10 = Math.sqrt(variance10);
    expect(result[9].rollingStdDev).toBeCloseTo(std10, 5);
  });

  it('should preserve dates from input', () => {
    const data = createFittedDataWithResiduals([0.1, 0.2, 0.3]);
    const result = calculateRollingVolatility(data);

    expect(result[0].date).toEqual(data[0].date);
    expect(result[1].date).toEqual(data[1].date);
    expect(result[2].date).toEqual(data[2].date);
  });

  it('should handle constant residuals (zero std dev)', () => {
    const data = createFittedDataWithResiduals([0.5, 0.5, 0.5, 0.5, 0.5]);
    const result = calculateRollingVolatility(data, 5);

    // All residuals are the same, so std dev should be 0
    expect(result[4].rollingStdDev).toBeCloseTo(0, 10);
  });

  it('should calculate volatility decreasing trend correctly', () => {
    // Simulate decreasing volatility: high variance early, low variance later
    const earlyResiduals = [1, -1, 1, -1, 1]; // High variance
    const lateResiduals = [0.1, 0.11, 0.09, 0.1, 0.1]; // Low variance
    const data = createFittedDataWithResiduals([...earlyResiduals, ...lateResiduals]);

    const result = calculateRollingVolatility(data, 5);

    // Early volatility (index 4) should be higher than late volatility (index 9)
    const earlyVol = result[4].rollingStdDev!;
    const lateVol = result[9].rollingStdDev!;
    expect(earlyVol).toBeGreaterThan(lateVol);
  });
});
