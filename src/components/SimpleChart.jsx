import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

function SimpleChart({ contractAddress }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    console.log('Creating simple chart...');
    
    const chart = createChart(containerRef.current, {
      width: 800,
      height: 400,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Simple test data
    const data = [
      { time: '2023-01-01', open: 0.04, high: 0.045, low: 0.035, close: 0.043 },
      { time: '2023-01-02', open: 0.043, high: 0.048, low: 0.041, close: 0.045 },
      { time: '2023-01-03', open: 0.045, high: 0.047, low: 0.042, close: 0.044 },
    ];

    console.log('Setting simple data:', data);
    series.setData(data);

    return () => {
      chart.remove();
    };
  }, [contractAddress]);

  return (
    <div style={{ 
      width: '800px', 
      height: '400px', 
      border: '2px solid red',
      margin: '20px auto'
    }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export default SimpleChart;
