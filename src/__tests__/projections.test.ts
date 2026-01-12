import {
  generateProjections,
  generateProjectionDates,
  daysSinceGenesis,
  powerLawPrice,
} from '../lib/powerlaw';
import { PowerLawFit } from '../lib/types';

describe('generateProjectionDates', () => {
  it('should generate approximately 365 dates for 1 year projection', () => {
    const startDate = new Date('2024-01-01T00:00:00Z');
    const dates = generateProjectionDates(startDate, 1);

    // 1 year = 365 days
    expect(dates.length).toBe(365);
  });

  it('should generate approximately 3650 dates for 10 year projection', () => {
    const startDate = new Date('2024-01-01T00:00:00Z');
    const dates = generateProjectionDates(startDate, 10);

    // 10 years = ~3650 days
    expect(dates.length).toBe(3650);
  });

  it('should generate approximately projectionYears * 365 dates', () => {
    const startDate = new Date('2024-01-01T00:00:00Z');

    for (const years of [1, 5, 10, 15, 25]) {
      const dates = generateProjectionDates(startDate, years);
      const expectedDays = Math.round(years * 365);
      expect(dates.length).toBe(expectedDays);
    }
  });

  it('should start from the day after the start date', () => {
    const startDate = new Date('2024-01-01T00:00:00Z');
    const dates = generateProjectionDates(startDate, 1);

    // First date should be Jan 2, 2024
    const firstDate = dates[0];
    expect(firstDate.getUTCFullYear()).toBe(2024);
    expect(firstDate.getUTCMonth()).toBe(0); // January
    expect(firstDate.getUTCDate()).toBe(2);
  });

  it('should have daily cadence', () => {
    const startDate = new Date('2024-01-01T00:00:00Z');
    const dates = generateProjectionDates(startDate, 1);

    // Check consecutive days differ by exactly 1 day (86400000 ms)
    const msPerDay = 24 * 60 * 60 * 1000;
    for (let i = 1; i < Math.min(dates.length, 100); i++) {
      const diff = dates[i].getTime() - dates[i - 1].getTime();
      expect(diff).toBe(msPerDay);
    }
  });
});

describe('generateProjections', () => {
  // Sample fit parameters (typical for BTC)
  const sampleFit: PowerLawFit = {
    A: 1e-17,
    B: 5.82,
    rSquared: 0.95,
    sigma: 0.45,
  };

  it('should generate approximately projectionYears * 365 projection points', () => {
    const lastDate = new Date('2024-01-01T00:00:00Z');

    for (const years of [1, 5, 10, 15, 25]) {
      const projections = generateProjections(lastDate, sampleFit, years);
      const expectedPoints = Math.round(years * 365);
      expect(projections.length).toBe(expectedPoints);
    }
  });

  it('should mark all points as projections', () => {
    const lastDate = new Date('2024-01-01T00:00:00Z');
    const projections = generateProjections(lastDate, sampleFit, 1);

    for (const point of projections) {
      expect(point.isProjection).toBe(true);
    }
  });

  it('should compute correct model prices using power law formula', () => {
    const lastDate = new Date('2024-01-01T00:00:00Z');
    const projections = generateProjections(lastDate, sampleFit, 1);

    // Check first few projections have correct model price
    for (let i = 0; i < 10; i++) {
      const point = projections[i];
      const expectedPrice = powerLawPrice(point.daysSinceGenesis, sampleFit);
      expect(point.fittedPrice).toBeCloseTo(expectedPrice, 2);
    }
  });

  it('should compute correct band values', () => {
    const lastDate = new Date('2024-01-01T00:00:00Z');
    const projections = generateProjections(lastDate, sampleFit, 1);

    for (const point of projections.slice(0, 10)) {
      const modelPrice = point.fittedPrice;
      const sigma = sampleFit.sigma;

      // Check band calculations: model * exp(±nσ)
      expect(point.band1SigmaUpper).toBeCloseTo(modelPrice * Math.exp(sigma), 2);
      expect(point.band1SigmaLower).toBeCloseTo(modelPrice * Math.exp(-sigma), 2);
      expect(point.band2SigmaUpper).toBeCloseTo(modelPrice * Math.exp(2 * sigma), 2);
      expect(point.band2SigmaLower).toBeCloseTo(modelPrice * Math.exp(-2 * sigma), 2);
    }
  });

  it('should have monotonically increasing daysSinceGenesis', () => {
    const lastDate = new Date('2024-01-01T00:00:00Z');
    const projections = generateProjections(lastDate, sampleFit, 5);

    for (let i = 1; i < projections.length; i++) {
      expect(projections[i].daysSinceGenesis).toBeGreaterThan(
        projections[i - 1].daysSinceGenesis
      );
    }
  });

  it('should have monotonically increasing fitted prices (for positive exponent)', () => {
    const lastDate = new Date('2024-01-01T00:00:00Z');
    const projections = generateProjections(lastDate, sampleFit, 5);

    // With B > 0, prices should increase over time
    for (let i = 1; i < projections.length; i++) {
      expect(projections[i].fittedPrice).toBeGreaterThan(
        projections[i - 1].fittedPrice
      );
    }
  });

  it('should have timestamps that match dates', () => {
    const lastDate = new Date('2024-01-01T00:00:00Z');
    const projections = generateProjections(lastDate, sampleFit, 1);

    for (const point of projections.slice(0, 10)) {
      expect(point.timestamp).toBe(point.date.getTime());
    }
  });

  it('should start projection from the day after last real date', () => {
    const lastDate = new Date('2024-06-15T00:00:00Z');
    const projections = generateProjections(lastDate, sampleFit, 1);

    // First projection should be June 16, 2024
    const firstProjection = projections[0];
    expect(firstProjection.date.getUTCFullYear()).toBe(2024);
    expect(firstProjection.date.getUTCMonth()).toBe(5); // June (0-indexed)
    expect(firstProjection.date.getUTCDate()).toBe(16);
  });

  it('should correctly calculate daysSinceGenesis for projection points', () => {
    const lastDate = new Date('2024-01-01T00:00:00Z');
    const projections = generateProjections(lastDate, sampleFit, 1);

    // daysSinceGenesis for Jan 2, 2024
    const firstProjectionDays = daysSinceGenesis(new Date('2024-01-02T00:00:00Z'));
    expect(projections[0].daysSinceGenesis).toBe(firstProjectionDays);
  });
});
