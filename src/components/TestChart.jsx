import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

function TestChart() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    console.log('Creating test chart...');
    
    const chart = createChart(containerRef.current, {
      width: 800,
      height: 400,
      layout: {
        background: { type: 'solid', color: '#101522' },
        textColor: '#b7c8e8'
      },
      grid: {
        vertLines: { color: '#1e2940' },
        horzLines: { color: '#1e2940' },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Add some test data
    const testData = [
      { time: 1756908900, open: 0.043, high: 0.044, low: 0.042, close: 0.0435 },
      { time: 1756908930, open: 0.0435, high: 0.045, low: 0.043, close: 0.044 },
      { time: 1756908960, open: 0.044, high: 0.045, low: 0.0435, close: 0.0445 },
      { time: 1756908990, open: 0.0445, high: 0.046, low: 0.044, close: 0.045 },
    ];

    console.log('Setting test data:', testData);
    series.setData(testData);

    return () => {
      chart.remove();
    };
  }, []);

  return (
    <div style={{ padding: '20px', background: '#0f1420', minHeight: '100vh' }}>
      <h2 style={{ color: 'white', marginBottom: '20px' }}>Test Chart</h2>
      <div 
        ref={containerRef} 
        style={{ 
          width: '800px', 
          height: '400px', 
          border: '2px solid #ef4444',
          background: '#1a1f2e'
        }}
      />
    </div>
  );
}

export default TestChart;
