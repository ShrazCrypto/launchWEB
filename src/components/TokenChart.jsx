import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { getContractData, SEC_PER_FRAME } from '../data/testData';

// in-memory cache to avoid regenerating on every click
const dataCache = new Map(); // key: `${contract}|${timeframe}|${type}` -> array

// Clear cache when contract changes to ensure fresh data
let lastContract = null;

// helper to know if seconds should be visible on the x-axis
const frameHasSeconds = (tf) => ['1s','5s','15s','30s'].includes(tf);

// sensible default windows per timeframe (keeps payload tiny & fast)
const WINDOW_BY_TF = {
  '1s':  3600,    // last 1 hour (more data for scrolling)
  '5s':  720,     // last ~1 hour
  '15s': 240,     // last ~1 hour
  '30s': 240,     // last ~2 hours
  '1m':  1440,    // last 24 hours (more data for scrolling)
  '5m':  288,     // last 24 hours
  '15m': 192,     // last 48 hours
  '30m': 192,     // last 96 hours
  '1h':  168,     // last 1 week
  '4h':  168,     // last 4 weeks (reduced from 336 to stay under 30-day limit)
  '6h':  120,     // last 3 weeks (reduced from 240 to stay under 30-day limit)
  '24h':  30,     // last 30 days (reduced from 180 to stay under 30-day limit)
  '1w':   4,      // last 4 weeks (reduced from 104 to stay under 30-day limit)
};

function TokenChart({ contractAddress }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const [timeframe, setTimeframe] = useState('1s');
  const [chartType, setChartType] = useState('candlestick');
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Refs to avoid stale state in subscriptions
  const allDataRef = useRef([]);
  const isLoadingMoreRef = useRef(false);
  const unsubscribeVisibleRangeRef = useRef(null);
  const timeframeRef = useRef(timeframe);
  const chartTypeRef = useRef(chartType);
  const contractRef = useRef(contractAddress);
  const throttleRef = useRef(0);

  // Update refs when state changes
  useEffect(() => { allDataRef.current = allData; }, [allData]);
  useEffect(() => { isLoadingMoreRef.current = isLoadingMore; }, [isLoadingMore]);
  useEffect(() => { timeframeRef.current = timeframe; }, [timeframe]);
  useEffect(() => { chartTypeRef.current = chartType; }, [chartType]);
  useEffect(() => { contractRef.current = contractAddress; }, [contractAddress]);

  const cacheKey = useMemo(
    () => `${contractAddress}|${timeframe}|${chartType}`,
    [contractAddress, timeframe, chartType]
  );

  // 1) Create chart once
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    


    const chart = createChart(containerRef.current, {
      width: Math.max(containerRef.current.clientWidth, 800),
      height: Math.max(containerRef.current.clientHeight, 400),
      layout: { 
        background: { type: 'solid', color: '#101522' }, 
        textColor: '#b7c8e8' 
      },
      grid: {
        vertLines: { color: '#1e2940' },
        horzLines: { color: '#1e2940' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#3b82f6', width: 1, style: 2 },
        horzLine: { color: '#3b82f6', width: 1, style: 2 },
      },
      rightPriceScale: { 
        borderColor: '#2b364d', 
        textColor: '#b7c8e8',
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
        // Prevent extreme scaling issues
        minValue: 0,
        maxValue: undefined, // Let it auto-scale
        // Better price formatting
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001,
        }
      },
      leftPriceScale: { 
        visible: false 
      },
      timeScale: {
        borderColor: '#2b364d',
        textColor: '#b7c8e8',
        timeVisible: true,
        secondsVisible: frameHasSeconds(timeframe),
        rightOffset: 0,
        barSpacing: 6,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        rightBarStaysOnScroll: true,
        borderVisible: false,
        visible: true,
        // Enable mouse interactions
        handleScroll: true,
        handleScale: true,
        // Enable zooming
        minBarSpacing: 0.5,
        maxBarSpacing: 50,
      },
              // Enable zooming
      zoom: {
        mouseWheel: true,
        axisPressedMouseMove: true,
        pinch: true,
      },
    });


    chartRef.current = chart;

    // robust resize
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    ro.observe(containerRef.current);

    // Subscribe to visible range changes - load more data when gaps appear
    unsubscribeVisibleRangeRef.current = chart.timeScale().subscribeVisibleLogicalRangeChange(async (logicalRange) => {
      if (!seriesRef.current || isLoadingMoreRef.current) return;
      
      // Only enable for 1s and 1m timeframes
      const tf = timeframeRef.current;
      if (tf !== '1s' && tf !== '1m') return;
      
      // throttle (~150ms)
      const now = performance.now();
      if (now - throttleRef.current < 150) return;
      throttleRef.current = now;
      
      const barsInfo = seriesRef.current.barsInLogicalRange(logicalRange);
      
      if (barsInfo !== null) {
        const curr = allDataRef.current;
        if (curr.length === 0) return;

        // Check if we need more data (when barsBefore is small, we're near the left edge)
        const needsMoreData = barsInfo.barsBefore < 30;
        
        if (needsMoreData) {
          setIsLoadingMore(true);
          try {
            const type = chartTypeRef.current;
            const mint = contractRef.current;
            const secPerBar = SEC_PER_FRAME[tf] ?? 60;
            
            // Get the current visible range
            const visibleRange = chart.timeScale().getVisibleRange();
            if (!visibleRange) return;
            
            // Calculate how much more data to load
            const currentStart = curr[0]?.time ?? 1756909000;
            const visibleStart = visibleRange.from;
            const timeGap = visibleStart - currentStart;
            
            // Load data from (currentStart - gap) to currentStart
            const newStart = Math.max(0, currentStart - Math.abs(timeGap) * 2);
            
            const moreData = await getContractData(
              mint, tf, type,
              { 
                start: newStart, 
                end: currentStart - 1 
              }
            );

            if (moreData.length > 0) {
              // ensure strict increasing time: drop any overlap
              const firstRight = curr[0]?.time ?? Infinity;
              const left = moreData.filter(b => b.time < firstRight);
              const updatedData = [...left, ...curr];
              
              setAllData(updatedData);
              seriesRef.current.setData(updatedData);
              console.log(`Loaded ${left.length} more bars, total: ${updatedData.length}`);
            }
          } catch (error) {
            console.error('Error loading more data:', error);
          } finally {
            setIsLoadingMore(false);
          }
        }
      }
    });

    return () => {
      ro.disconnect();
      if (unsubscribeVisibleRangeRef.current) {
        unsubscribeVisibleRangeRef.current();
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // no deps -> only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Ensure the correct series exists when chartType changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    


    // remove previous series if any
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Clear the data cache for this chart type to force fresh data load
    const cacheKey = `${contractRef.current}|${timeframeRef.current}|${chartType}`;
    dataCache.delete(cacheKey);
    
    // Clear allData state to force fresh data loading
    setAllData([]);

    // create the right series
    if (chartType === 'candlestick' || chartType === 'marketCap') {
      seriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',      // Enhanced green for both price and market cap
        downColor: '#ef4444',    // Enhanced red for both price and market cap
        wickUpColor: '#22c55e',  // Enhanced green wicks for both
        wickDownColor: '#ef4444', // Enhanced red wicks for both
        borderVisible: false,
        priceFormat: {
          type: 'price',
          precision: chartType === 'marketCap' ? 0 : 6, // mcap = integer units
          minMove: chartType === 'marketCap' ? 1 : 0.000001,
        },
      });
      
      // Apply enhanced series options
      seriesRef.current.applyOptions({
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineColor: '#3b82f6',
      });
      
      // Update the right price scale to handle the different value ranges
      chart.applyOptions({
        rightPriceScale: {
          autoScale: true,
          scaleMargins: { top: 0.1, bottom: 0.1 },
          minValue: 0,
          maxValue: undefined, // Let it auto-scale
          priceFormat: {
            type: 'price',
            precision: chartType === 'marketCap' ? 0 : 6,
            minMove: chartType === 'marketCap' ? 1 : 0.000001,
          }
        }
      });
    } else {
      seriesRef.current = chart.addSeries(LineSeries, {
        lineWidth: 2,
        color: '#3b82f6',
        priceFormat: { type: 'price', precision: 6, minMove: 0.000001 },
      });
      
      // Apply enhanced series options for line chart
      seriesRef.current.applyOptions({
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineColor: '#3b82f6',
      });
    }
  }, [chartType]);

  // 3) Clear chart and re-render when timeframe changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    
    // Clear all data and reset chart
    if (seriesRef.current) {
      seriesRef.current.setData([]);
    }
    
    // Update timeScale options while preserving interactive capabilities
    chart.applyOptions({
      timeScale: { 
        secondsVisible: frameHasSeconds(timeframe),
        rightOffset: 0,
        barSpacing: 6,
        fixLeftEdge: false, // Allow scrolling to left edge
        fixRightEdge: false, // Allow scrolling to right edge
        lockVisibleTimeRangeOnResize: false, // Allow resizing
        rightBarStaysOnScroll: true,
        borderVisible: false,
        visible: true,
        timeVisible: true,
        // Preserve mouse interactions
        handleScroll: true,
        handleScale: true,
        // Preserve zooming
        minBarSpacing: 0.5,
        maxBarSpacing: 50,
      },
    });
    
    // Clear the data cache for this timeframe to force fresh data load
    const cacheKey = `${contractRef.current}|${timeframe}|${chartTypeRef.current}`;
    dataCache.delete(cacheKey);
    
    // Clear allData state to force fresh data loading
    setAllData([]);
    
  }, [timeframe]);

  // 4) Load data (with cache) and set it on the active series
  useEffect(() => {
    let cancelled = false;
    
    // Clear cache if contract changed
    if (lastContract !== contractAddress) {
      dataCache.clear();
      lastContract = contractAddress;
    }
    
    const run = async () => {
      setLoading(true);

      try {
        let data = dataCache.get(cacheKey);
        if (!data) {
          // ask generator for the requested number of bars
          const barsRequested = WINDOW_BY_TF[timeframe] ?? 200;
          const FIXED_NOW = 1756909000; // Same as server and testData
          data = await getContractData(
            contractAddress,
            timeframe,
            chartType,
            { limit: barsRequested, end: FIXED_NOW } // <- pass to generator
          );
          dataCache.set(cacheKey, data);
        }
        
        if (!cancelled && seriesRef.current) {
          // Validate data before setting it
          const validData = data.filter(item => 
            item && 
            typeof item.time === 'number' && 
            typeof item.open === 'number' && 
            typeof item.high === 'number' && 
            typeof item.low === 'number' && 
            typeof item.close === 'number' &&
            item.open > 0 && item.high > 0 && item.low > 0 && item.close > 0 &&
            item.high >= Math.max(item.open, item.close) &&
            item.low <= Math.min(item.open, item.close)
          );
          
          if (validData.length > 0) {
            setAllData(validData);
            try {
              seriesRef.current.setData(validData);
              // Reset to the right edge (most recent data)
              chartRef.current?.timeScale().scrollToPosition(0, false);
            } catch (error) {
              console.error('Error setting data on series:', error);
            }
          } else {
            console.warn('No valid data found for chart');
            setAllData([]);
            seriesRef.current.setData([]);
          }
        }
      } catch (e) {
        console.error('Error loading chart data', e);
        if (!cancelled && seriesRef.current) {
          setAllData([]);
          seriesRef.current.setData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [cacheKey, contractAddress, timeframe, chartType]);

  return (
    <div className="token-chart">
      <div className="chart-container" ref={containerRef}>
        {loading && (
          <div className="chart-loading">
            <div className="loading-spinner"></div>
            <p>Loading chart data...</p>
          </div>
        )}
        {isLoadingMore && (
          <div className="chart-loading-more">
            <div className="loading-spinner"></div>
            <p>Loading more data...</p>
          </div>
        )}
      </div>

      <div className="chart-controls-bar">
        <div className="timeframe-buttons">
          {['1s','5s','15s','30s','1m','5m','15m','30m','1h','4h','6h','24h','1w'].map(tf => (
            <button
              key={tf}
              className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="chart-type-buttons">
          {['candlestick','line','marketCap'].map(type => (
            <button
              key={type}
              className={`chart-type-btn ${chartType === type ? 'active' : ''}`}
              onClick={() => setChartType(type)}
            >
              {type === 'candlestick' ? 'Candlestick' :
               type === 'line' ? 'Line' : 'Market Cap'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TokenChart;
