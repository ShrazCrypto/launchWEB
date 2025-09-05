// server.js
// npm i express compression morgan
import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import fs from 'fs';

// Load data file
let candleData = null;
try {
  const dataFile = JSON.parse(fs.readFileSync('data/candles.json', 'utf8'));
  candleData = dataFile;
  console.log(`Loaded ${candleData.price.length} data points from file`);
} catch (error) {
  console.error('Error loading data file:', error.message);
  console.log('Please run: node generateDataFile.js');
  process.exit(1);
}

// -------------------- Utils --------------------
const TF_SEC = {
  '1s':1, '5s':5, '15s':15, '30s':30,
  '1m':60, '5m':300, '15m':900, '30m':1800,
  '1h':3600, '4h':14400, '6h':21600, '24h':86400, '1w':604800,
};

function alignEnd(endSec, secPerBar) {
  // last completed bar end (inclusive)
  return Math.floor(endSec / secPerBar) * secPerBar - 1;
}

function bucketStart(t, s) { 
  return Math.floor(t / s) * s; 
}

function hashStr(s) {
  let h = 0;
  for (let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; }
  return Math.abs(h) || 1;
}

// -------------------- Aggregation --------------------
function aggregateCandles(seconds, secPerBar) {
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

// -------------------- Data Service --------------------
class FileDataService {
  constructor(data) {
    this.data = data;
    this.cache = new Map(); // Cache aggregated results
  }
  
  getCandles({ mint, tf, start, end, type, limit = 100 }) {
    const secPerBar = TF_SEC[tf] || 60;
    const cacheKey = `${mint}|${tf}|${start}|${end}|${type}|${limit}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // Get the appropriate dataset
    const dataset = type === 'mcap' ? this.data.marketCap : this.data.price;
    
    // Find data within the requested range
    const filteredData = dataset.filter(d => d.time >= start && d.time <= end);
    
    if (filteredData.length === 0) {
      this.cache.set(cacheKey, []);
      return [];
    }
    
    // Aggregate to the requested timeframe
    let result = aggregateCandles(filteredData, secPerBar);
    
    // Apply limit (take last N bars)
    if (limit && result.length > limit) {
      result = result.slice(-limit);
    }
    
    // Cache the result
    this.cache.set(cacheKey, result);
    return result;
  }

  // Get paginated data for infinite scroll (only from existing data)
  getPaginatedData({ mint, tf, start, end, type, page = 0, pageSize = 100 }) {
    const secPerBar = TF_SEC[tf] || 60;
    const dataset = type === 'mcap' ? this.data.marketCap : this.data.price;
    
    // Find data within the requested range
    const filteredData = dataset.filter(d => d.time >= start && d.time <= end);
    
    if (filteredData.length === 0) {
      return [];
    }
    
    // Aggregate to the requested timeframe
    let result = aggregateCandles(filteredData, secPerBar);
    
    // Apply pagination
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    result = result.slice(startIndex, endIndex);
    
    return result;
  }

}

// -------------------- API --------------------
const app = express();
app.use(compression());
app.use(morgan('tiny'));

const service = new FileDataService(candleData);

/**
 * GET /api/candles/:mint?tf=1m&start=unixSec&end=unixSec&type=price|mcap&limit=100
 * returns: [{ time, open, high, low, close, volume }]
 */
app.get('/api/candles/:mint', (req, res) => {
  try {
    const mint = req.params.mint;
    const tf = String(req.query.tf || '1m');
    const type = String(req.query.type || 'price'); // price | mcap
    
    // Use a fixed "now" time for deterministic data
    const FIXED_NOW = 1756909000;
    const end = Number(req.query.end ?? FIXED_NOW);
    const limit = Number(req.query.limit ?? 100);
    const secPerBar = TF_SEC[tf] || 60;
    const start = Number(req.query.start ?? (end - limit*secPerBar + 1));

    // Hard guard to prevent silly spans
    const SPAN_CAP = 30 * 24 * 60 * 60; // 30 days
    if ((end - start + 1) > SPAN_CAP) {
      return res.status(400).json({ error: 'range too large' });
    }

    // Handle beginning of time case
    const tokenLaunchTime = candleData.metadata.startTime;
    const adjustedStart = Math.max(start, tokenLaunchTime);
    
    // If we're at the beginning and no data would be generated, return empty array
    if (adjustedStart > end) {
      return res.json([]);
    }

    const data = service.getCandles({ 
      mint, 
      tf, 
      start: adjustedStart, 
      end, 
      type,
      limit 
    });
    
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal', message: String(e?.message || e) });
  }
});

/**
 * GET /api/candles/:mint/paginated?tf=1s&start=unixSec&end=unixSec&type=price&page=0&pageSize=100
 * For infinite scroll pagination (only loads from existing data)
 */
app.get('/api/candles/:mint/paginated', (req, res) => {
  try {
    const mint = req.params.mint;
    const tf = String(req.query.tf || '1s');
    const type = String(req.query.type || 'price');
    const start = Number(req.query.start);
    const end = Number(req.query.end);
    const page = Number(req.query.page || 0);
    const pageSize = Number(req.query.pageSize || 100);

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end required' });
    }

    const data = service.getPaginatedData({ 
      mint, 
      tf, 
      start, 
      end, 
      type,
      page,
      pageSize 
    });
    
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal', message: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`File-based Candle API listening on http://localhost:${PORT}`);
  console.log(`Data range: ${candleData.metadata.startTime} to ${candleData.metadata.endTime}`);
  console.log(`Total data points: ${candleData.price.length}`);
});
