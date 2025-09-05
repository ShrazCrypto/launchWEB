// Client-side API facade with pagination support for 1s and 1m timeframes
export const SEC_PER_FRAME = {
  '1s':1,'5s':5,'15s':15,'30s':30,'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'6h':21600,'24h':86400,'1w':604800,
};

// Cache for the base data
const dataCache = new Map(); // key: `${mint}|${type}` -> array
const paginatedDataCache = new Map(); // key: `${mint}|${type}|${page}` -> array

// Helper function to aggregate 1-second data into different timeframes
function aggregateData(seconds, secPerBar) {
  if (secPerBar === 1) return seconds;
  
  const buckets = new Map();
  for (const c of seconds) {
    const bucketStart = Math.floor(c.time / secPerBar) * secPerBar;
    let row = buckets.get(bucketStart);
    if (!row) {
      row = { 
        time: bucketStart, 
        open: c.open, 
        high: c.high, 
        low: c.low, 
        close: c.close, 
        volume: c.volume 
      };
      buckets.set(bucketStart, row);
    } else {
      row.high = Math.max(row.high, c.high);
      row.low = Math.min(row.low, c.low);
      row.close = c.close; // Last close in the bucket
      row.volume += c.volume;
    }
  }
  return Array.from(buckets.values()).sort((a,b) => a.time - b.time);
}

// Fetch paginated data for infinite scroll
async function fetchPaginatedData(mint, type, start, end, page = 0, pageSize = 100) {
  const url = `/api/candles/${encodeURIComponent(mint)}/paginated?tf=1s&start=${start}&end=${end}&type=${type}&page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return await res.json();
}

export async function getContractData(mint, timeframe, chartType, opts = {}) {
  const secPerBar = SEC_PER_FRAME[timeframe] ?? 60;
  const FIXED_NOW = 1756909000;
  const limit = opts.limit ?? 100;
  
  const type = chartType === 'marketCap' ? 'mcap' : 'price';
  
  // Handle time range requests for infinite scroll
  if (opts.start !== undefined && opts.end !== undefined && (timeframe === '1s' || timeframe === '1m')) {
    const start = opts.start;
    const end = opts.end;
    
    // Fetch data for the specific time range
    const url = `/api/candles/${encodeURIComponent(mint)}?tf=1s&start=${start}&end=${end}&type=${type}&limit=${end - start + 1}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const baseData = await res.json();
    
    // Aggregate the base data to the requested timeframe
    const aggregatedData = aggregateData(baseData, secPerBar);
    
    if (chartType === 'line') {
      return aggregatedData.map(r => ({ time: r.time, value: r.close }));
    }
    return aggregatedData;
  }
  
  // Regular request - load initial data
  const cacheKey = `${mint}|${type}`;
  let baseData = dataCache.get(cacheKey);
  
  if (!baseData) {
    // Load the full 7-day dataset upfront
    const baseStart = 1756304201; // Start of our 7-day dataset
    const baseEnd = FIXED_NOW;
    
    // Fetch the data
    const url = `/api/candles/${encodeURIComponent(mint)}?tf=1s&start=${baseStart}&end=${baseEnd}&type=${type}&limit=${baseEnd - baseStart + 1}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const rows = await res.json();
    
    baseData = rows;
    dataCache.set(cacheKey, baseData);
  }
  
  // Aggregate the base data to the requested timeframe
  const aggregatedData = aggregateData(baseData, secPerBar);
  
  // Return only the requested number of bars, from the end
  const result = aggregatedData.slice(-limit);
  
  if (chartType === 'line') {
    return result.map(r => ({ time: r.time, value: r.close })); // LWC line shape
  }
  return result; // LWC candlestick shape
}

