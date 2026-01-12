import { promises as fs } from 'fs';
import path from 'path';

interface CryptoCompareResponse {
  Response: string;
  Data: {
    Data: {
      time: number;
      close: number;
      high: number;
      low: number;
      open: number;
    }[];
  };
}

interface PricePoint {
  timestamp: number;
  price: number;
}

const OUTPUT_FILE = path.join(process.cwd(), 'src', 'data', 'btc-historical.json');

async function fetchHistoricalData(): Promise<void> {
  console.log('Fetching BTC historical data from CryptoCompare...');

  const allPrices: PricePoint[] = [];
  const limit = 2000; // Max per request
  let toTs = Math.floor(Date.now() / 1000);
  const startTs = new Date('2010-07-17').getTime() / 1000; // First BTC exchange

  let iteration = 0;
  const maxIterations = 10; // Safety limit

  while (toTs > startTs && iteration < maxIterations) {
    iteration++;
    console.log(`Fetching chunk ${iteration}... (to: ${new Date(toTs * 1000).toISOString().slice(0, 10)})`);

    const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=${limit}&toTs=${toTs}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      break;
    }

    const data: CryptoCompareResponse = await response.json();

    if (data.Response !== 'Success' || !data.Data?.Data?.length) {
      console.error('No data in response');
      break;
    }

    const prices = data.Data.Data
      .filter(d => d.close > 0 && d.time > 0)
      .map(d => ({
        timestamp: d.time * 1000, // Convert to milliseconds
        price: d.close,
      }));

    if (prices.length === 0) {
      console.log('No more data available');
      break;
    }

    // Add to beginning (we're going backwards in time)
    allPrices.unshift(...prices);

    console.log(`  Got ${prices.length} points (${new Date(prices[0].timestamp).toISOString().slice(0, 10)} to ${new Date(prices[prices.length - 1].timestamp).toISOString().slice(0, 10)})`);

    // Move window back
    toTs = Math.floor(prices[0].timestamp / 1000) - 86400;

    // Check if we've reached the start
    if (prices[0].timestamp / 1000 <= startTs) {
      console.log('Reached start date');
      break;
    }

    // Rate limit pause
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Deduplicate by date
  const seen = new Set<string>();
  const dedupedPrices = allPrices.filter(p => {
    const dateKey = new Date(p.timestamp).toISOString().slice(0, 10);
    if (seen.has(dateKey)) return false;
    seen.add(dateKey);
    return true;
  });

  // Sort by timestamp
  dedupedPrices.sort((a, b) => a.timestamp - b.timestamp);

  // Filter to only include data from 2010 onwards with valid prices
  const filteredPrices = dedupedPrices.filter(p => p.price > 0 && p.timestamp >= new Date('2010-07-17').getTime());

  console.log(`\nTotal: ${filteredPrices.length} daily data points`);
  console.log(`Date range: ${new Date(filteredPrices[0].timestamp).toISOString().slice(0, 10)} to ${new Date(filteredPrices[filteredPrices.length - 1].timestamp).toISOString().slice(0, 10)}`);

  // Save to file
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(filteredPrices, null, 2));
  console.log(`\nSaved to ${OUTPUT_FILE}`);
}

fetchHistoricalData().catch(console.error);
