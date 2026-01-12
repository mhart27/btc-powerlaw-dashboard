import { format, parseISO } from 'date-fns';

// Bitcoin halving dates - store as YYYY-MM-DD strings for consistent formatting
export const HALVING_DATES = [
  { date: new Date('2012-11-28T00:00:00Z'), dateStr: '2012-11-28', label: 'Halving 1', blockHeight: 210000 },
  { date: new Date('2016-07-09T00:00:00Z'), dateStr: '2016-07-09', label: 'Halving 2', blockHeight: 420000 },
  { date: new Date('2020-05-11T00:00:00Z'), dateStr: '2020-05-11', label: 'Halving 3', blockHeight: 630000 },
  { date: new Date('2024-04-20T00:00:00Z'), dateStr: '2024-04-20', label: 'Halving 4', blockHeight: 840000 },
] as const;

// Bitcoin genesis date for cycle boundaries
export const BITCOIN_GENESIS = new Date('2009-01-03T00:00:00Z');

// Cycle boundaries (start dates for each halving cycle)
export const HALVING_CYCLES = [
  { start: BITCOIN_GENESIS, end: HALVING_DATES[0].date, label: 'Cycle 1', color: 'rgba(239, 68, 68, 0.05)' },   // Red tint
  { start: HALVING_DATES[0].date, end: HALVING_DATES[1].date, label: 'Cycle 2', color: 'rgba(249, 115, 22, 0.05)' }, // Orange tint
  { start: HALVING_DATES[1].date, end: HALVING_DATES[2].date, label: 'Cycle 3', color: 'rgba(234, 179, 8, 0.05)' },  // Yellow tint
  { start: HALVING_DATES[2].date, end: HALVING_DATES[3].date, label: 'Cycle 4', color: 'rgba(34, 197, 94, 0.05)' },  // Green tint
  { start: HALVING_DATES[3].date, end: new Date('2028-04-20T00:00:00Z'), label: 'Cycle 5', color: 'rgba(59, 130, 246, 0.05)' }, // Blue tint (estimated next halving)
] as const;

// Get halving dates as YYYY-MM-DD strings
export function getHalvingDateStrings(): string[] {
  return HALVING_DATES.map(h => h.dateStr);
}

// Check if a date string falls on a halving date
export function isHalvingDate(dateStr: string): boolean {
  const halvingStrings = getHalvingDateStrings();
  return halvingStrings.includes(dateStr.slice(0, 10));
}

// Get the halving info for a specific date string
export function getHalvingInfo(dateStr: string): typeof HALVING_DATES[number] | null {
  const targetDate = dateStr.slice(0, 10);
  return HALVING_DATES.find(h => h.dateStr === targetDate) || null;
}

// Find which cycle a date belongs to
export function getCycleForDate(date: Date): typeof HALVING_CYCLES[number] | null {
  const timestamp = date.getTime();
  return HALVING_CYCLES.find(c =>
    timestamp >= c.start.getTime() && timestamp < c.end.getTime()
  ) || null;
}

// Get halving indices for a given array of date labels (YYYY-MM-DD format)
// Uses closest-match approach to handle sampling gaps
export function getHalvingIndices(labels: string[]): { index: number; halving: typeof HALVING_DATES[number] }[] {
  const result: { index: number; halving: typeof HALVING_DATES[number] }[] = [];

  if (labels.length === 0) return result;

  const minLabel = labels[0];
  const maxLabel = labels[labels.length - 1];

  for (const halving of HALVING_DATES) {
    const halvingStr = halving.dateStr;

    // Skip if halving is outside the label range
    if (halvingStr < minLabel || halvingStr > maxLabel) {
      continue;
    }

    // Try exact match first
    let index = labels.findIndex(label => label === halvingStr);

    // If no exact match, find closest date (first label >= halving date)
    if (index === -1) {
      index = labels.findIndex(label => label >= halvingStr);
    }

    if (index !== -1) {
      result.push({ index, halving });
    }
  }

  return result;
}

// Debug helper: Get info about halving coverage in labels
export function debugHalvingCoverage(labels: string[]): {
  minDate: string;
  maxDate: string;
  halvings: { dateStr: string; inRange: boolean; foundIndex: number | null }[];
} {
  if (labels.length === 0) {
    return { minDate: '', maxDate: '', halvings: [] };
  }

  const minDate = labels[0];
  const maxDate = labels[labels.length - 1];

  const halvings = HALVING_DATES.map(h => {
    const inRange = h.dateStr >= minDate && h.dateStr <= maxDate;
    let foundIndex: number | null = labels.findIndex(l => l === h.dateStr);
    if (foundIndex === -1) {
      // Find closest
      const closestIdx = labels.findIndex(l => l >= h.dateStr);
      foundIndex = closestIdx !== -1 && inRange ? closestIdx : null;
    }
    return { dateStr: h.dateStr, inRange, foundIndex };
  });

  return { minDate, maxDate, halvings };
}
