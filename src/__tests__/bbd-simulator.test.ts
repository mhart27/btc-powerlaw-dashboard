import {
  getScenarioPrice,
  generatePricePath,
  generateMixedPricePath,
  runBBDSimulation,
  getYearlyData,
  formatUsd,
  formatLtv,
  BBDSimulatorConfig,
  PriceScenario,
  HistoricalPricePoint,
} from '../lib/bbd-simulator';
import { PowerLawFit } from '../lib/types';

// Mock fit parameters (simplified for testing)
const mockFit: PowerLawFit = {
  A: 1e-17, // Simplified coefficient
  B: 5.8,   // Typical power law exponent
  rSquared: 0.95,
  sigma: 0.5, // ~65% band width in log space
};

// Reference date for testing (Jan 1, 2025)
const testDate = new Date('2025-01-01T00:00:00Z');

describe('getScenarioPrice', () => {
  it('should return fair value price for fair scenario', () => {
    const price = getScenarioPrice(testDate, mockFit, 'fair');
    expect(price).toBeGreaterThan(0);
  });

  it('should return higher price for plus1sigma scenario', () => {
    const fairPrice = getScenarioPrice(testDate, mockFit, 'fair');
    const plusSigmaPrice = getScenarioPrice(testDate, mockFit, 'plus1sigma');

    expect(plusSigmaPrice).toBeGreaterThan(fairPrice);
    // Should be exp(sigma) times higher
    expect(plusSigmaPrice / fairPrice).toBeCloseTo(Math.exp(mockFit.sigma), 5);
  });

  it('should return lower price for minus1sigma scenario', () => {
    const fairPrice = getScenarioPrice(testDate, mockFit, 'fair');
    const minusSigmaPrice = getScenarioPrice(testDate, mockFit, 'minus1sigma');

    expect(minusSigmaPrice).toBeLessThan(fairPrice);
    // Should be exp(-sigma) times lower
    expect(minusSigmaPrice / fairPrice).toBeCloseTo(Math.exp(-mockFit.sigma), 5);
  });

  it('should return even lower price for minus2sigma scenario', () => {
    const minus1SigmaPrice = getScenarioPrice(testDate, mockFit, 'minus1sigma');
    const minus2SigmaPrice = getScenarioPrice(testDate, mockFit, 'minus2sigma');

    expect(minus2SigmaPrice).toBeLessThan(minus1SigmaPrice);
  });

  it('should return higher price for plus2sigma (Mania) scenario', () => {
    const fairPrice = getScenarioPrice(testDate, mockFit, 'fair');
    const plus1SigmaPrice = getScenarioPrice(testDate, mockFit, 'plus1sigma');
    const plus2SigmaPrice = getScenarioPrice(testDate, mockFit, 'plus2sigma');

    expect(plus2SigmaPrice).toBeGreaterThan(plus1SigmaPrice);
    expect(plus2SigmaPrice).toBeGreaterThan(fairPrice);
    // Should be exp(2*sigma) times higher than fair
    expect(plus2SigmaPrice / fairPrice).toBeCloseTo(Math.exp(2 * mockFit.sigma), 5);
  });

  it('should have symmetric +2σ and -2σ bands around fair value', () => {
    const fairPrice = getScenarioPrice(testDate, mockFit, 'fair');
    const plus2SigmaPrice = getScenarioPrice(testDate, mockFit, 'plus2sigma');
    const minus2SigmaPrice = getScenarioPrice(testDate, mockFit, 'minus2sigma');

    // In log space, +2σ and -2σ should be symmetric
    const logRatioUp = Math.log(plus2SigmaPrice / fairPrice);
    const logRatioDown = Math.log(fairPrice / minus2SigmaPrice);

    expect(logRatioUp).toBeCloseTo(logRatioDown, 5);
    expect(logRatioUp).toBeCloseTo(2 * mockFit.sigma, 5);
  });
});

describe('generatePricePath', () => {
  it('should generate correct number of monthly data points', () => {
    const path = generatePricePath(testDate, 5, mockFit, 'fair');

    // 5 years = 60 months, plus initial month = 61 data points
    expect(path).toHaveLength(61);
  });

  it('should start from the provided date', () => {
    const path = generatePricePath(testDate, 1, mockFit, 'fair');

    expect(path[0].date.getTime()).toBe(testDate.getTime());
  });

  it('should have increasing prices over time for fair scenario', () => {
    const path = generatePricePath(testDate, 5, mockFit, 'fair');

    // Power law model predicts increasing prices over time
    const firstPrice = path[0].price;
    const lastPrice = path[path.length - 1].price;

    expect(lastPrice).toBeGreaterThan(firstPrice);
  });

  it('should have monthly intervals', () => {
    const path = generatePricePath(testDate, 1, mockFit, 'fair');

    // Check that dates are one month apart
    for (let i = 1; i < path.length; i++) {
      const prevDate = path[i - 1].date;
      const currDate = path[i].date;

      // Should be approximately 1 month later (using UTC methods)
      const monthDiff = (currDate.getUTCFullYear() - prevDate.getUTCFullYear()) * 12
        + (currDate.getUTCMonth() - prevDate.getUTCMonth());
      expect(monthDiff).toBe(1);
    }
  });
});

describe('generateMixedPricePath', () => {
  // Create historical data for 2024
  const historicalData: HistoricalPricePoint[] = [
    { date: new Date('2024-01-01T00:00:00Z'), price: 42000 },
    { date: new Date('2024-02-01T00:00:00Z'), price: 44000 },
    { date: new Date('2024-03-01T00:00:00Z'), price: 65000 },
    { date: new Date('2024-04-01T00:00:00Z'), price: 68000 },
    { date: new Date('2024-05-01T00:00:00Z'), price: 62000 },
    { date: new Date('2024-06-01T00:00:00Z'), price: 64000 },
    { date: new Date('2024-07-01T00:00:00Z'), price: 58000 },
    { date: new Date('2024-08-01T00:00:00Z'), price: 59000 },
    { date: new Date('2024-09-01T00:00:00Z'), price: 63000 },
    { date: new Date('2024-10-01T00:00:00Z'), price: 70000 },
    { date: new Date('2024-11-01T00:00:00Z'), price: 92000 },
    { date: new Date('2024-12-01T00:00:00Z'), price: 98000 },
  ];

  it('should use historical prices for past dates', () => {
    const startDate = new Date('2024-01-01T00:00:00Z');
    const path = generateMixedPricePath(startDate, 1, mockFit, 'fair', historicalData);

    // First few months should use historical prices
    expect(path[0].price).toBe(42000);
    expect(path[0].isProjection).toBe(false);
    expect(path[1].price).toBe(44000);
    expect(path[1].isProjection).toBe(false);
  });

  it('should use projected prices for future dates', () => {
    const startDate = new Date('2024-01-01T00:00:00Z');
    const path = generateMixedPricePath(startDate, 2, mockFit, 'fair', historicalData);

    // Find a date that's definitely in the future (past today)
    const futureEntries = path.filter(p => p.isProjection);
    expect(futureEntries.length).toBeGreaterThan(0);

    // Future entries should have model-based prices
    for (const entry of futureEntries) {
      expect(entry.price).toBeGreaterThan(0);
    }
  });

  it('should return all projection=true when no historical data matches', () => {
    const futureStart = new Date('2030-01-01T00:00:00Z');
    const path = generateMixedPricePath(futureStart, 1, mockFit, 'fair', historicalData);

    // All dates should be projections since we're starting in 2030
    for (const entry of path) {
      expect(entry.isProjection).toBe(true);
    }
  });

  it('should mark isProjection field correctly', () => {
    const startDate = new Date('2024-06-01T00:00:00Z');
    const path = generateMixedPricePath(startDate, 2, mockFit, 'fair', historicalData);

    // Should have mix of historical and projected
    const historicalEntries = path.filter(p => !p.isProjection);
    const projectedEntries = path.filter(p => p.isProjection);

    // Should have some historical data (2024-06 to 2024-12)
    expect(historicalEntries.length).toBeGreaterThan(0);
    // Should have projected data (2025+)
    expect(projectedEntries.length).toBeGreaterThan(0);
  });
});

describe('runBBDSimulation', () => {
  const baseConfig: BBDSimulatorConfig = {
    btcHeld: 1,
    monthlySpendingUsd: 5000,
    interestAprPercent: 10,
    liquidationLtvPercent: 80,
    startingLtvPercent: null,
    borrowMonthly: true,
    borrowFrequency: 'monthly',
    interestMode: 'capitalize',
    projectionYears: 5,
    scenario: 'fair',
    startDate: '2025-01',
    spendingSteps: [],
  };

  describe('with borrow monthly mode', () => {
    it('should increase loan balance each month', () => {
      const result = runBBDSimulation(baseConfig, mockFit, testDate);

      // Check that loan balance increases
      expect(result.steps[0].loanBalance).toBe(0);
      expect(result.steps[1].loanBalance).toBeGreaterThan(0);

      // Each month should add spending
      expect(result.steps[1].borrowedThisMonth).toBe(baseConfig.monthlySpendingUsd);
    });

    it('should capitalize interest when configured', () => {
      const result = runBBDSimulation(baseConfig, mockFit, testDate);

      // After month 1, loan = spending
      // After month 2, loan = (spending + spending) * (1 + rate) = 2*spending*(1+rate)
      // The second month should have more than just 2x spending due to interest
      const month2Balance = result.steps[2].loanBalance;
      const expectedWithoutInterest = 2 * baseConfig.monthlySpendingUsd;

      expect(month2Balance).toBeGreaterThan(expectedWithoutInterest);
    });
  });

  describe('with pay interest monthly mode', () => {
    it('should track interest paid but not increase balance', () => {
      const config: BBDSimulatorConfig = {
        ...baseConfig,
        interestMode: 'pay_monthly',
      };

      const result = runBBDSimulation(config, mockFit, testDate);

      // After 2 months, loan should be exactly 2x spending (no capitalized interest)
      const expectedBalance = 2 * config.monthlySpendingUsd;
      expect(result.steps[2].loanBalance).toBeCloseTo(expectedBalance, 0);

      // Should have interest paid recorded
      expect(result.summary.totalInterestPaid).toBeGreaterThan(0);
    });
  });

  describe('with starting LTV mode', () => {
    it('should initialize loan based on starting LTV', () => {
      const config: BBDSimulatorConfig = {
        ...baseConfig,
        borrowMonthly: false,
        startingLtvPercent: 20,
      };

      const result = runBBDSimulation(config, mockFit, testDate);

      const initialCollateral = result.steps[0].collateralValue;
      const initialLoan = result.steps[0].loanBalance;
      const initialLtv = result.steps[0].ltv;

      expect(initialLtv).toBeCloseTo(0.2, 2);
      expect(initialLoan).toBeCloseTo(initialCollateral * 0.2, 0);
    });

    it('should not borrow monthly in starting LTV mode', () => {
      const config: BBDSimulatorConfig = {
        ...baseConfig,
        borrowMonthly: false,
        startingLtvPercent: 20,
      };

      const result = runBBDSimulation(config, mockFit, testDate);

      // No borrowing after initial setup
      for (let i = 1; i < result.steps.length; i++) {
        expect(result.steps[i].borrowedThisMonth).toBe(0);
      }
    });
  });

  describe('liquidation', () => {
    it('should trigger liquidation when LTV exceeds threshold', () => {
      // Use minus2sigma scenario for more likely liquidation
      const config: BBDSimulatorConfig = {
        ...baseConfig,
        scenario: 'minus2sigma',
        liquidationLtvPercent: 50,
        projectionYears: 20,
      };

      const result = runBBDSimulation(config, mockFit, testDate);

      // With aggressive borrowing in a bear scenario, should eventually liquidate
      if (result.summary.isLiquidated) {
        expect(result.summary.liquidationMonth).not.toBeNull();
        expect(result.steps[result.steps.length - 1].isLiquidated).toBe(true);

        // Simulation should stop after liquidation
        expect(result.steps.length).toBeLessThanOrEqual(config.projectionYears * 12 + 1);
      }
    });

    it('should stop simulation after liquidation', () => {
      const config: BBDSimulatorConfig = {
        ...baseConfig,
        scenario: 'minus2sigma',
        liquidationLtvPercent: 30, // Very low threshold
        projectionYears: 20,
      };

      const result = runBBDSimulation(config, mockFit, testDate);

      if (result.summary.isLiquidated) {
        // All steps after liquidation should be marked as liquidated
        const liquidationIdx = result.steps.findIndex(s => s.isLiquidated);
        expect(liquidationIdx).toBe(result.steps.length - 1);
      }
    });
  });

  describe('summary calculations', () => {
    it('should calculate correct total borrowed', () => {
      const result = runBBDSimulation(baseConfig, mockFit, testDate);

      // In borrow monthly mode, total borrowed = spending * (months - 1)
      // since we don't borrow in month 0
      const expectedBorrowed = baseConfig.monthlySpendingUsd * (result.steps.length - 1);
      expect(result.summary.totalBorrowed).toBeCloseTo(expectedBorrowed, 0);
    });

    it('should track net equity correctly', () => {
      const result = runBBDSimulation(baseConfig, mockFit, testDate);

      for (const step of result.steps) {
        const expectedEquity = step.collateralValue - step.loanBalance;
        expect(step.netEquity).toBeCloseTo(expectedEquity, 0);
      }
    });
  });

  describe('with yearly borrow frequency', () => {
    const yearlyConfig: BBDSimulatorConfig = {
      ...baseConfig,
      btcHeld: 10, // More BTC to avoid liquidation
      monthlySpendingUsd: 1000,
      borrowFrequency: 'yearly',
      projectionYears: 3,
      scenario: 'plus1sigma', // Optimistic to avoid liquidation
      startDate: '2025-01',
    };

    it('should only borrow once per year at yearly intervals', () => {
      const result = runBBDSimulation(yearlyConfig, mockFit, testDate);

      // Check that borrowing only happens at months 12, 24, 36
      for (let i = 0; i < result.steps.length; i++) {
        const step = result.steps[i];
        if (i > 0 && i % 12 === 0) {
          // Should borrow at yearly intervals
          expect(step.borrowedThisMonth).toBe(yearlyConfig.monthlySpendingUsd * 12);
        } else {
          // Should not borrow in other months
          expect(step.borrowedThisMonth).toBe(0);
        }
      }
    });

    it('should borrow 12x monthly amount at each yearly interval', () => {
      const result = runBBDSimulation(yearlyConfig, mockFit, testDate);
      const yearlyAmount = yearlyConfig.monthlySpendingUsd * 12;

      // Check month 12 borrowed amount
      if (result.steps.length > 12) {
        expect(result.steps[12].borrowedThisMonth).toBe(yearlyAmount);
      }
    });

    it('should have total borrowed equal to 12x monthly over N years', () => {
      const result = runBBDSimulation(yearlyConfig, mockFit, testDate);

      // 3 years = 3 yearly borrowing events (at months 12, 24, 36)
      const expectedYearlyBorrows = Math.floor((result.steps.length - 1) / 12);
      const expectedTotalBorrowed = expectedYearlyBorrows * yearlyConfig.monthlySpendingUsd * 12;

      expect(result.summary.totalBorrowed).toBeCloseTo(expectedTotalBorrowed, 0);
    });

    it('should show step-jumps in LTV at yearly intervals', () => {
      const result = runBBDSimulation(yearlyConfig, mockFit, testDate);

      // Before month 12, LTV should be 0 (no borrowing yet)
      for (let i = 0; i < 12 && i < result.steps.length; i++) {
        expect(result.steps[i].loanBalance).toBe(0);
        expect(result.steps[i].ltv).toBe(0);
      }

      // At month 12, there should be a jump in loan balance
      if (result.steps.length > 12) {
        expect(result.steps[12].loanBalance).toBeGreaterThan(0);
        expect(result.steps[12].ltv).toBeGreaterThan(0);
      }
    });

    it('should still accrue interest monthly even with yearly borrowing', () => {
      const config: BBDSimulatorConfig = {
        ...yearlyConfig,
        interestMode: 'capitalize',
      };

      const result = runBBDSimulation(config, mockFit, testDate);

      // After the first yearly borrow at month 12, interest should accrue monthly
      if (result.steps.length > 14) {
        const month12Balance = result.steps[12].loanBalance;
        const month13Balance = result.steps[13].loanBalance;

        // Month 13 should have higher balance due to interest (no new borrowing)
        expect(month13Balance).toBeGreaterThan(month12Balance);
        expect(result.steps[13].borrowedThisMonth).toBe(0);
      }
    });
  });

  describe('borrow frequency has no effect in starting LTV mode', () => {
    it('should ignore borrow frequency when not in borrow mode', () => {
      const config: BBDSimulatorConfig = {
        ...baseConfig,
        borrowMonthly: false,
        startingLtvPercent: 20,
        borrowFrequency: 'yearly', // Should be ignored
        projectionYears: 2,
      };

      const result = runBBDSimulation(config, mockFit, testDate);

      // No borrowing should happen after initial setup regardless of frequency
      for (let i = 1; i < result.steps.length; i++) {
        expect(result.steps[i].borrowedThisMonth).toBe(0);
      }
    });
  });

  describe('isProjection field in simulation steps', () => {
    it('should mark steps as projection when no historical data provided', () => {
      const result = runBBDSimulation(baseConfig, mockFit, testDate);

      // All steps should be marked as projection when no historical data
      for (const step of result.steps) {
        expect(step.isProjection).toBe(true);
      }
    });

    it('should mark steps correctly when historical data is provided', () => {
      const historicalData: HistoricalPricePoint[] = [
        { date: new Date('2025-01-01T00:00:00Z'), price: 100000 },
        { date: new Date('2025-02-01T00:00:00Z'), price: 105000 },
        { date: new Date('2025-03-01T00:00:00Z'), price: 102000 },
      ];

      const config: BBDSimulatorConfig = {
        ...baseConfig,
        projectionYears: 1,
        startDate: '2025-01',
      };

      const result = runBBDSimulation(config, mockFit, testDate, historicalData);

      // First few steps should use historical data (isProjection = false)
      // Later steps should be projections (isProjection = true)
      const historicalSteps = result.steps.filter(s => !s.isProjection);
      const projectionSteps = result.steps.filter(s => s.isProjection);

      // Should have some historical steps matching our data
      expect(historicalSteps.length).toBeGreaterThan(0);
      // Should have projection steps for future months
      expect(projectionSteps.length).toBeGreaterThan(0);
    });

    it('should use historical prices when available', () => {
      const historicalData: HistoricalPricePoint[] = [
        { date: new Date('2025-01-01T00:00:00Z'), price: 99999 },
      ];

      const config: BBDSimulatorConfig = {
        ...baseConfig,
        projectionYears: 1,
        startDate: '2025-01',
      };

      const result = runBBDSimulation(config, mockFit, testDate, historicalData);

      // First step should use the historical price
      expect(result.steps[0].btcPrice).toBe(99999);
      expect(result.steps[0].isProjection).toBe(false);
    });
  });
});

describe('getYearlyData', () => {
  it('should include first step (month 0)', () => {
    const config: BBDSimulatorConfig = {
      btcHeld: 1,
      monthlySpendingUsd: 5000,
      interestAprPercent: 10,
      liquidationLtvPercent: 80,
      startingLtvPercent: null,
      borrowMonthly: true,
      borrowFrequency: 'monthly',
      interestMode: 'capitalize',
      projectionYears: 3,
      scenario: 'fair',
      startDate: '2025-01',
      spendingSteps: [],
    };

    const result = runBBDSimulation(config, mockFit, testDate);
    const yearly = getYearlyData(result.steps);

    expect(yearly[0].month).toBe(0);
  });

  it('should include yearly intervals', () => {
    const config: BBDSimulatorConfig = {
      btcHeld: 10, // More BTC to avoid liquidation
      monthlySpendingUsd: 1000, // Lower spending
      interestAprPercent: 5,
      liquidationLtvPercent: 90,
      startingLtvPercent: null,
      borrowMonthly: true,
      borrowFrequency: 'monthly',
      interestMode: 'capitalize',
      projectionYears: 3,
      scenario: 'plus1sigma', // Optimistic scenario
      startDate: '2025-01',
      spendingSteps: [],
    };

    const result = runBBDSimulation(config, mockFit, testDate);
    const yearly = getYearlyData(result.steps);

    // Should have: month 0, month 12, month 24, month 36
    expect(yearly).toHaveLength(4);
    expect(yearly[1].month).toBe(12);
    expect(yearly[2].month).toBe(24);
    expect(yearly[3].month).toBe(36);
  });

  it('should include final step if simulation ends early', () => {
    // Create a scenario that might liquidate early
    const config: BBDSimulatorConfig = {
      btcHeld: 0.1,
      monthlySpendingUsd: 10000,
      interestAprPercent: 15,
      liquidationLtvPercent: 50,
      startingLtvPercent: null,
      borrowMonthly: true,
      borrowFrequency: 'monthly',
      interestMode: 'capitalize',
      projectionYears: 10,
      scenario: 'minus2sigma',
      startDate: '2025-01',
      spendingSteps: [],
    };

    const result = runBBDSimulation(config, mockFit, testDate);

    if (result.summary.isLiquidated) {
      const yearly = getYearlyData(result.steps);
      const lastYearly = yearly[yearly.length - 1];
      const lastStep = result.steps[result.steps.length - 1];

      // Final step should be included
      expect(lastYearly.month).toBe(lastStep.month);
    }
  });
});

describe('formatUsd', () => {
  it('should format millions correctly', () => {
    expect(formatUsd(1_500_000)).toBe('$1.50M');
    expect(formatUsd(10_000_000)).toBe('$10.00M');
  });

  it('should format thousands correctly', () => {
    expect(formatUsd(50_000)).toBe('$50.0k');
    expect(formatUsd(1_500)).toBe('$1.5k');
  });

  it('should format small values correctly', () => {
    expect(formatUsd(500)).toBe('$500');
    expect(formatUsd(0)).toBe('$0');
  });

  it('should handle negative values', () => {
    expect(formatUsd(-1_500_000)).toBe('$-1.50M');
    expect(formatUsd(-50_000)).toBe('$-50.0k');
  });
});

describe('formatLtv', () => {
  it('should format LTV as percentage', () => {
    expect(formatLtv(0.5)).toBe('50.0%');
    expect(formatLtv(0.333)).toBe('33.3%');
    expect(formatLtv(1)).toBe('100.0%');
  });
});
