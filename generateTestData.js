// Simple test data generation script
import fs from 'fs';

// Configuration
const SECONDS_TO_GENERATE = 10; // Just 10 seconds for testing
const BASE_PRICE = 0.043; // Starting price in SOL
const BASE_MARKET_CAP = BASE_PRICE * 1000000; // Starting market cap

// Generate consistent second-by-second data
const generateTestData = () => {
  const data = [];
  const now = Math.floor(Date.now() / 1000);
  
  let currentPrice = BASE_PRICE;
  let currentMarketCap = BASE_MARKET_CAP;
  
  // Generate data for every second
  for (let second = 0; second < SECONDS_TO_GENERATE; second++) {
    const time = now - second;
    
    // Price volatility (0.1% per second for realistic movement)
    const priceVolatility = 0.001;
    const priceOpen = currentPrice;
    const priceHigh = priceOpen * (1 + Math.random() * priceVolatility);
    const priceLow = priceOpen * (1 - Math.random() * priceVolatility);
    const priceClose = priceLow + Math.random() * (priceHigh - priceLow);
    
    // Market cap volatility (0.05% per second - more stable)
    const marketCapVolatility = 0.0005;
    const marketCapOpen = currentMarketCap;
    const marketCapHigh = marketCapOpen * (1 + Math.random() * marketCapVolatility);
    const marketCapLow = marketCapOpen * (1 - Math.random() * marketCapVolatility);
    const marketCapClose = marketCapLow + Math.random() * (marketCapHigh - marketCapLow);
    
    // Update current values for next iteration
    currentPrice = priceClose;
    currentMarketCap = marketCapClose;
    
    data.push({
      time: time,
      // Price data
      open: parseFloat(priceOpen.toFixed(6)),
      high: parseFloat(priceHigh.toFixed(6)),
      low: parseFloat(priceLow.toFixed(6)),
      close: parseFloat(priceClose.toFixed(6)),
      // Market cap data
      marketCapOpen: parseFloat(marketCapOpen.toFixed(2)),
      marketCapHigh: parseFloat(marketCapHigh.toFixed(2)),
      marketCapLow: parseFloat(marketCapLow.toFixed(2)),
      marketCapClose: parseFloat(marketCapClose.toFixed(2)),
      // Additional metrics
      volume: Math.floor(Math.random() * 1000) + 100,
      totalSupply: 1000000
    });
  }
  
  return data;
};

// Generate the data
console.log('Generating test data...');
const testData = generateTestData();

// Create the data file content
const dataFileContent = `// Auto-generated test data
// Generated on: ${new Date().toISOString()}
// Total data points: ${testData.length}
// Time range: ${SECONDS_TO_GENERATE} seconds

// Base configuration
const BASE_PRICE = ${BASE_PRICE};
const BASE_MARKET_CAP = ${BASE_MARKET_CAP};
const TOTAL_SUPPLY = 1000000;

// Pre-generated consistent data (${testData.length} data points)
export const TEST_DATA = ${JSON.stringify(testData, null, 2)};

// Data processing function
export const processTestData = (data, timeframe, chartType) => {
  if (!data || data.length === 0) {
    return [];
  }

  // Determine how many data points to include based on timeframe
  let dataPoints = data.length;
  switch (timeframe) {
    case '1s':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '5s':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '15s':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '30s':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '1m':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '5m':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '15m':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '30m':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '1h':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '4h':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '6h':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '24h':
      dataPoints = Math.min(10, data.length); // 10 seconds
      break;
    case '1w':
      dataPoints = data.length; // All data
      break;
    default:
      dataPoints = Math.min(10, data.length); // Default to 10 seconds
  }

  // Take the most recent data points
  const recentData = data.slice(-dataPoints);

  // Process data based on chart type
  switch (chartType) {
    case 'candlestick':
      return recentData.map(item => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close
      }));
    
    case 'line':
      return recentData.map(item => ({
        time: item.time,
        value: item.close
      }));
    
    case 'marketCap':
      return recentData.map(item => ({
        time: item.time,
        open: item.marketCapOpen,
        high: item.marketCapHigh,
        low: item.marketCapLow,
        close: item.marketCapClose
      }));
    
    default:
      return recentData.map(item => ({
        time: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close
      }));
  }
};

// Function to get data for specific contract (for future API integration)
export const getContractData = async (contractAddress, timeframe, chartType) => {
  // TODO: Replace with actual API call
  // const response = await fetch(\`/api/token/\${contractAddress}/data?timeframe=\${timeframe}\`);
  // const data = await response.json();
  // return processTestData(data, timeframe, chartType);
  
  // For now, return processed test data
  return processTestData(TEST_DATA, timeframe, chartType);
};

// Export raw data for debugging
export const RAW_TEST_DATA = TEST_DATA;

// Data statistics for reference
export const getDataStats = () => {
  const latest = TEST_DATA[TEST_DATA.length - 1];
  const earliest = TEST_DATA[0];
  
  return {
    totalDataPoints: TEST_DATA.length,
    dateRange: {
      start: new Date(earliest.time * 1000).toISOString(),
      end: new Date(latest.time * 1000).toISOString()
    },
    priceRange: {
      min: Math.min(...TEST_DATA.map(d => d.low)),
      max: Math.max(...TEST_DATA.map(d => d.high)),
      current: latest.close
    },
    marketCapRange: {
      min: Math.min(...TEST_DATA.map(d => d.marketCapLow)),
      max: Math.max(...TEST_DATA.map(d => d.marketCapHigh)),
      current: latest.marketCapClose
    }
  };
};
`;

// Write the data file
fs.writeFileSync('src/data/testData.js', dataFileContent);

console.log(`✅ Generated ${testData.length} data points`);
console.log(`✅ Data spans ${SECONDS_TO_GENERATE} seconds`);
console.log(`✅ File written to src/data/testData.js`);

// Show sample data
console.log('\n📊 Sample data:');
console.log(JSON.stringify(testData.slice(0, 3), null, 2));

// Delete this generation file
try {
  fs.unlinkSync('generateTestData.js');
  console.log('\n✅ Generation file deleted');
} catch (error) {
  console.log('\n⚠️ Could not delete generation file:', error.message);
}
