import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { PriceDataPoint } from '@/lib/types';
import { daysSinceGenesis } from '@/lib/powerlaw';

// Import bundled historical data
import historicalData from '@/data/btc-historical.json';

interface CoinGeckoMarketChart {
  prices: [number, number][];
}

interface CacheData {
  lastUpdated: number;
  prices: { timestamp: number; price: number }[];
}

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'btc-usd-recent.json');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const priceData = await getOrFetchPriceData();
    return NextResponse.json(priceData);
  } catch (error) {
    console.error('Error fetching BTC price data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BTC price data' },
      { status: 500 }
    );
  }
}

async function getOrFetchPriceData(): Promise<PriceDataPoint[]> {
  // Load bundled historical data
  const bundledPrices = (historicalData as { timestamp: number; price: number }[])
    .map(p => ({ ...p }));

  // Find the most recent date in bundled data
  const lastBundledTs = bundledPrices.length > 0
    ? bundledPrices[bundledPrices.length - 1].timestamp
    : 0;

  // Try to get fresh recent data
  const recentPrices = await getRecentData(lastBundledTs);

  // Combine bundled historical data with recent data
  // Only use bundled data that's older than our recent fetch
  const recentStartTs = recentPrices.length > 0
    ? recentPrices[0].timestamp
    : Date.now();

  const olderBundledPrices = bundledPrices.filter(
    p => p.timestamp < recentStartTs - MS_PER_DAY
  );

  const combinedPrices = [...olderBundledPrices, ...recentPrices];

  // Deduplicate by date (keep last occurrence for each date)
  const priceMap = new Map<string, { timestamp: number; price: number }>();
  for (const p of combinedPrices) {
    const dateKey = new Date(p.timestamp).toISOString().slice(0, 10);
    priceMap.set(dateKey, p);
  }

  const dedupedPrices = Array.from(priceMap.values())
    .sort((a, b) => a.timestamp - b.timestamp);

  return convertToDataPoints(dedupedPrices);
}

async function getRecentData(afterTimestamp: number): Promise<{ timestamp: number; price: number }[]> {
  // Ensure cache directory exists
  await ensureCacheDir();

  // Check cache
  const cachedData = await loadCache();
  const now = Date.now();

  if (cachedData && cachedData.prices.length > 0) {
    const hoursSinceUpdate = (now - cachedData.lastUpdated) / (1000 * 60 * 60);

    if (hoursSinceUpdate < 1) {
      // Cache is fresh, use it
      console.log('Using cached recent data');
      return cachedData.prices;
    }
  }

  // Fetch fresh data from CoinGecko (last 30 days)
  console.log('Fetching recent data from CoinGecko...');
  try {
    const freshData = await fetchFromCoinGecko(30);

    if (freshData.length > 0) {
      // Save to cache
      await saveCache({ lastUpdated: now, prices: freshData });
      console.log(`Cached ${freshData.length} recent data points`);
      return freshData;
    }
  } catch (error) {
    console.warn('CoinGecko fetch failed:', error);
  }

  // If fetch failed, return cached data if available
  if (cachedData && cachedData.prices.length > 0) {
    console.log('Using stale cache due to fetch failure');
    return cachedData.prices;
  }

  // No recent data available
  return [];
}

async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

async function loadCache(): Promise<CacheData | null> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data) as CacheData;
  } catch {
    return null;
  }
}

async function saveCache(data: CacheData): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch (error) {
    console.error('Failed to save cache:', error);
  }
}

async function fetchFromCoinGecko(days: number): Promise<{ timestamp: number; price: number }[]> {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`CoinGecko API error (${response.status}):`, errorText.slice(0, 200));
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data: CoinGeckoMarketChart = await response.json();

  return data.prices
    .filter(([, price]) => price > 0)
    .map(([timestamp, price]) => ({
      timestamp: normalizeToMidnight(timestamp),
      price,
    }));
}

function normalizeToMidnight(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function convertToDataPoints(prices: { timestamp: number; price: number }[]): PriceDataPoint[] {
  return prices.map(({ timestamp, price }) => {
    const date = new Date(timestamp);
    return {
      date,
      timestamp,
      price,
      daysSinceGenesis: daysSinceGenesis(date),
    };
  });
}
