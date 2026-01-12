import {
  HALVING_DATES,
  HALVING_CYCLES,
  BITCOIN_GENESIS,
  getHalvingDateStrings,
  isHalvingDate,
  getHalvingInfo,
  getCycleForDate,
  getHalvingIndices,
  debugHalvingCoverage,
} from '../lib/halvings';

describe('HALVING_DATES', () => {
  it('should have 4 halving events', () => {
    expect(HALVING_DATES).toHaveLength(4);
  });

  it('should have correct halving dates via dateStr', () => {
    expect(HALVING_DATES[0].dateStr).toBe('2012-11-28');
    expect(HALVING_DATES[1].dateStr).toBe('2016-07-09');
    expect(HALVING_DATES[2].dateStr).toBe('2020-05-11');
    expect(HALVING_DATES[3].dateStr).toBe('2024-04-20');
  });

  it('should have Date objects matching dateStr', () => {
    expect(HALVING_DATES[0].date.toISOString().slice(0, 10)).toBe('2012-11-28');
    expect(HALVING_DATES[1].date.toISOString().slice(0, 10)).toBe('2016-07-09');
    expect(HALVING_DATES[2].date.toISOString().slice(0, 10)).toBe('2020-05-11');
    expect(HALVING_DATES[3].date.toISOString().slice(0, 10)).toBe('2024-04-20');
  });

  it('should have correct block heights', () => {
    expect(HALVING_DATES[0].blockHeight).toBe(210000);
    expect(HALVING_DATES[1].blockHeight).toBe(420000);
    expect(HALVING_DATES[2].blockHeight).toBe(630000);
    expect(HALVING_DATES[3].blockHeight).toBe(840000);
  });
});

describe('HALVING_CYCLES', () => {
  it('should have 5 cycles defined', () => {
    expect(HALVING_CYCLES).toHaveLength(5);
  });

  it('should have contiguous cycle boundaries', () => {
    // First cycle starts at genesis
    expect(HALVING_CYCLES[0].start.getTime()).toBe(BITCOIN_GENESIS.getTime());

    // Each cycle end should match next cycle start
    for (let i = 0; i < HALVING_CYCLES.length - 1; i++) {
      expect(HALVING_CYCLES[i].end.getTime()).toBe(HALVING_CYCLES[i + 1].start.getTime());
    }
  });

  it('should have cycle boundaries at halving dates', () => {
    expect(HALVING_CYCLES[0].end.getTime()).toBe(HALVING_DATES[0].date.getTime());
    expect(HALVING_CYCLES[1].end.getTime()).toBe(HALVING_DATES[1].date.getTime());
    expect(HALVING_CYCLES[2].end.getTime()).toBe(HALVING_DATES[2].date.getTime());
    expect(HALVING_CYCLES[3].end.getTime()).toBe(HALVING_DATES[3].date.getTime());
  });
});

describe('getHalvingDateStrings', () => {
  it('should return ISO date strings for all halvings', () => {
    const strings = getHalvingDateStrings();
    expect(strings).toHaveLength(4);
    expect(strings).toEqual(['2012-11-28', '2016-07-09', '2020-05-11', '2024-04-20']);
  });
});

describe('isHalvingDate', () => {
  it('should return true for halving dates', () => {
    expect(isHalvingDate('2012-11-28')).toBe(true);
    expect(isHalvingDate('2016-07-09')).toBe(true);
    expect(isHalvingDate('2020-05-11')).toBe(true);
    expect(isHalvingDate('2024-04-20')).toBe(true);
  });

  it('should return false for non-halving dates', () => {
    expect(isHalvingDate('2012-11-27')).toBe(false);
    expect(isHalvingDate('2023-01-01')).toBe(false);
    expect(isHalvingDate('2009-01-03')).toBe(false);
  });

  it('should handle date strings with time component', () => {
    expect(isHalvingDate('2012-11-28T12:00:00Z')).toBe(true);
    expect(isHalvingDate('2020-05-11T00:00:00.000Z')).toBe(true);
  });
});

describe('getHalvingInfo', () => {
  it('should return halving info for halving dates', () => {
    const info = getHalvingInfo('2012-11-28');
    expect(info).not.toBeNull();
    expect(info?.blockHeight).toBe(210000);
    expect(info?.label).toBe('Halving 1');
  });

  it('should return null for non-halving dates', () => {
    expect(getHalvingInfo('2023-01-01')).toBeNull();
  });
});

describe('getCycleForDate', () => {
  it('should return cycle 1 for dates before first halving', () => {
    const cycle = getCycleForDate(new Date('2010-01-01'));
    expect(cycle?.label).toBe('Cycle 1');
  });

  it('should return cycle 2 for dates between halving 1 and 2', () => {
    const cycle = getCycleForDate(new Date('2014-01-01'));
    expect(cycle?.label).toBe('Cycle 2');
  });

  it('should return cycle 3 for dates between halving 2 and 3', () => {
    const cycle = getCycleForDate(new Date('2018-01-01'));
    expect(cycle?.label).toBe('Cycle 3');
  });

  it('should return cycle 4 for dates between halving 3 and 4', () => {
    const cycle = getCycleForDate(new Date('2022-01-01'));
    expect(cycle?.label).toBe('Cycle 4');
  });

  it('should return cycle 5 for dates after halving 4', () => {
    const cycle = getCycleForDate(new Date('2025-01-01'));
    expect(cycle?.label).toBe('Cycle 5');
  });

  it('should return null for dates before genesis', () => {
    const cycle = getCycleForDate(new Date('2008-01-01'));
    expect(cycle).toBeNull();
  });

  it('should return null for dates beyond cycle 5 end', () => {
    const cycle = getCycleForDate(new Date('2030-01-01'));
    expect(cycle).toBeNull();
  });
});

describe('getHalvingIndices', () => {
  it('should return empty array when no halving dates in labels', () => {
    const labels = ['2010-01-01', '2010-01-02', '2010-01-03'];
    expect(getHalvingIndices(labels)).toEqual([]);
  });

  it('should return empty array for empty labels', () => {
    expect(getHalvingIndices([])).toEqual([]);
  });

  it('should return indices for halving dates found in labels', () => {
    const labels = ['2012-11-27', '2012-11-28', '2012-11-29'];
    const result = getHalvingIndices(labels);
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(1);
    expect(result[0].halving.blockHeight).toBe(210000);
  });

  it('should return multiple indices when multiple halvings in labels', () => {
    const labels = [
      '2012-11-28',
      '2013-01-01',
      '2016-07-09',
      '2017-01-01',
      '2020-05-11',
    ];
    const result = getHalvingIndices(labels);
    expect(result).toHaveLength(3);
    expect(result[0].index).toBe(0);
    expect(result[1].index).toBe(2);
    expect(result[2].index).toBe(4);
  });

  it('should return results in halving chronological order', () => {
    // Labels are chronologically sorted (as in real data)
    const labels = ['2012-11-28', '2016-07-09', '2020-05-11'];
    const result = getHalvingIndices(labels);
    // Results should be in halving order (chronological)
    expect(result).toHaveLength(3);
    expect(result[0].halving.blockHeight).toBe(210000);
    expect(result[1].halving.blockHeight).toBe(420000);
    expect(result[2].halving.blockHeight).toBe(630000);
  });

  it('should use closest-match when exact date is missing (sampling scenario)', () => {
    // Simulate sampled data that skips exact halving dates
    const labels = ['2012-11-25', '2012-11-30', '2012-12-05'];
    const result = getHalvingIndices(labels);
    // Should find closest date >= 2012-11-28, which is 2012-11-30 at index 1
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(1);
    expect(result[0].halving.dateStr).toBe('2012-11-28');
  });

  it('should find all 4 halvings when data range covers all dates', () => {
    // Create a range that covers all halvings
    const labels = [
      '2010-01-01',
      '2012-11-28',
      '2014-01-01',
      '2016-07-09',
      '2018-01-01',
      '2020-05-11',
      '2022-01-01',
      '2024-04-20',
      '2025-01-01',
    ];
    const result = getHalvingIndices(labels);
    expect(result).toHaveLength(4);
    expect(result.map(r => r.halving.dateStr)).toEqual([
      '2012-11-28',
      '2016-07-09',
      '2020-05-11',
      '2024-04-20',
    ]);
  });

  it('should skip halvings outside data range', () => {
    // Data only covers 2015-2021
    const labels = ['2015-01-01', '2016-07-09', '2018-01-01', '2020-05-11', '2021-01-01'];
    const result = getHalvingIndices(labels);
    // Should only find halving 2 (2016) and halving 3 (2020)
    expect(result).toHaveLength(2);
    expect(result[0].halving.dateStr).toBe('2016-07-09');
    expect(result[1].halving.dateStr).toBe('2020-05-11');
  });
});

describe('debugHalvingCoverage', () => {
  it('should return empty data for empty labels', () => {
    const result = debugHalvingCoverage([]);
    expect(result.minDate).toBe('');
    expect(result.maxDate).toBe('');
  });

  it('should return correct min/max dates', () => {
    const labels = ['2015-01-01', '2020-06-15', '2025-12-31'];
    const result = debugHalvingCoverage(labels);
    expect(result.minDate).toBe('2015-01-01');
    expect(result.maxDate).toBe('2025-12-31');
  });

  it('should mark halvings as in range or out of range', () => {
    const labels = ['2015-01-01', '2016-07-09', '2020-05-11', '2022-01-01'];
    const result = debugHalvingCoverage(labels);

    // 2012 halving is before range
    expect(result.halvings[0].dateStr).toBe('2012-11-28');
    expect(result.halvings[0].inRange).toBe(false);

    // 2016 and 2020 halvings are in range
    expect(result.halvings[1].dateStr).toBe('2016-07-09');
    expect(result.halvings[1].inRange).toBe(true);
    expect(result.halvings[2].dateStr).toBe('2020-05-11');
    expect(result.halvings[2].inRange).toBe(true);

    // 2024 halving is after range
    expect(result.halvings[3].dateStr).toBe('2024-04-20');
    expect(result.halvings[3].inRange).toBe(false);
  });

  it('should provide found indices for halvings in range', () => {
    const labels = ['2016-07-08', '2016-07-09', '2016-07-10'];
    const result = debugHalvingCoverage(labels);

    const halving2016 = result.halvings.find(h => h.dateStr === '2016-07-09');
    expect(halving2016?.foundIndex).toBe(1);
  });
});

// Tests for overlay conditions (simulating showHalvings behavior)
describe('Halving overlay conditions', () => {
  it('when showHalvings=true with full data range, should include all 4 halvings', () => {
    const showHalvings = true;
    const labels = [
      '2010-01-01',
      '2012-11-28',
      '2014-01-01',
      '2016-07-09',
      '2018-01-01',
      '2020-05-11',
      '2022-01-01',
      '2024-04-20',
      '2025-01-01',
    ];

    const halvingIndices = showHalvings ? getHalvingIndices(labels) : [];
    expect(halvingIndices).toHaveLength(4);
  });

  it('when showHalvings=false, should include no halvings', () => {
    const showHalvings = false;
    const labels = [
      '2010-01-01',
      '2012-11-28',
      '2014-01-01',
      '2016-07-09',
      '2018-01-01',
      '2020-05-11',
      '2022-01-01',
      '2024-04-20',
      '2025-01-01',
    ];

    const halvingIndices = showHalvings ? getHalvingIndices(labels) : [];
    expect(halvingIndices).toHaveLength(0);
  });

  it('with sampled data that skips exact dates, should still find all 4 halvings via closest match', () => {
    // Simulate weekly sampled data from 2010 to 2025
    const labels: string[] = [];
    const start = new Date('2010-01-01');
    const end = new Date('2025-12-31');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      labels.push(d.toISOString().slice(0, 10));
    }

    const result = getHalvingIndices(labels);
    expect(result).toHaveLength(4);

    // Each halving should be found
    const foundDates = result.map(r => r.halving.dateStr);
    expect(foundDates).toContain('2012-11-28');
    expect(foundDates).toContain('2016-07-09');
    expect(foundDates).toContain('2020-05-11');
    expect(foundDates).toContain('2024-04-20');
  });
});
