import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import TokenChart from './TokenChart';

// Helper functions
const shortAddr = (a) => a ? `${a.slice(0,4)}…${a.slice(-4)}` : '';
const fmtUSD = (n) => `$${n.toLocaleString(undefined,{maximumFractionDigits:2})}`;
const fmtPriceSOL = (n) => `${n.toFixed(6)} SOL`;
const fmtPct = (p) => `${(p*100).toFixed(2)}%`;
const fmtCompact = (n) => Intl.NumberFormat(undefined,{notation:'compact'}).format(n);
const hlPercent = (p, lo, hi) => {
  if (hi<=lo) return '0%';
  const x = Math.max(0, Math.min(1, (p - lo) / (hi - lo)));
  return `${(x*100).toFixed(1)}%`;
};
const identiconUrl = (addr) =>
  `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(addr || 'token')}&size=64&backgroundType=gradientLinear`;

// Stat Card Component
function StatCard({ label, value, delta, spark, loading = false }) {
  if (loading) {
    return (
      <div className="stat-card">
        <div className="label skeleton" style={{width: '60%', height: '12px'}}></div>
        <div className="value skeleton" style={{width: '80%', height: '18px', marginTop: '4px'}}></div>
        <div className="delta skeleton" style={{width: '40%', height: '12px', marginTop: '4px'}}></div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && (
        <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(delta))}
        </span>
      )}
    </div>
  );
}

function ContractPage() {
  const { contractAddress } = useParams();
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState(null);

  // Mock data - replace with real API calls
  useEffect(() => {
    const loadTokenData = async () => {
      setLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock data - replace with real API integration
      const mockData = {
        name: "Launchpad Token",
        symbol: "LPD",
        verified: true,
        priceSOL: 0.043284,
        priceUSD: 2.45,
        change24h: 0.0523, // 5.23% up
        high24h: 0.045123,
        low24h: 0.041567,
        marketCap: 43284,
        marketCapDelta: 0.0523,
        volume24h: 1250000,
        volumeDelta: 0.0234,
        fdv: 43284000,
        fdvDelta: 0.0523,
        holders: 1247
      };
      
      setTokenData(mockData);
      setLoading(false);
    };

    loadTokenData();
  }, [contractAddress]);

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(contractAddress);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const explorerUrl = (addr) => `https://explorer.solana.com/address/${addr}?cluster=devnet`;

  return (
    <div className="chart-page">
      {/* Token Header */}
      <header className="token-header">
        <div className="left">
          <img 
            className="token-avatar" 
            src={identiconUrl(contractAddress)} 
            alt="" 
          />
          <div>
            <div className="name-row">
              <span className="name">
                {loading ? <span className="skeleton" style={{width: '120px', height: '18px'}}></span> : tokenData?.name}
              </span>
              <span className="symbol">
                {loading ? <span className="skeleton" style={{width: '40px', height: '14px'}}></span> : `(${tokenData?.symbol})`}
              </span>
              <span className="chip network">Solana</span>
              {tokenData?.verified && <span className="chip verified">Verified</span>}
            </div>
            <div className="contract-row">
              <code className="contract">{shortAddr(contractAddress)}</code>
              <button className="link" onClick={copyContract}>Copy</button>
              <a 
                className="link" 
                href={explorerUrl(contractAddress)} 
                target="_blank" 
                rel="noreferrer"
              >
                Explorer ↗
              </a>
            </div>
          </div>
        </div>

        <div className="right price-strip">
          <div className="price-line">
            <span className="price">
              {loading ? (
                <span className="skeleton" style={{width: '140px', height: '24px'}}></span>
              ) : (
                fmtPriceSOL(tokenData?.priceSOL || 0)
              )}
            </span>
            <span className="price-usd">
              {loading ? (
                <span className="skeleton" style={{width: '60px', height: '16px'}}></span>
              ) : (
                `(${fmtUSD(tokenData?.priceUSD || 0)})`
              )}
            </span>
            {!loading && tokenData && (
              <span className={`pill ${tokenData.change24h >= 0 ? 'up' : 'down'}`}>
                {tokenData.change24h >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(tokenData.change24h))}
              </span>
            )}
          </div>
          <div className="hl-row">
            <span>
              {loading ? (
                <span className="skeleton" style={{width: '80px', height: '12px'}}></span>
              ) : (
                `24h L: ${fmtPriceSOL(tokenData?.low24h || 0)}`
              )}
            </span>
            <div className="hl-bar">
              {!loading && tokenData && (
                <span 
                  style={{
                    width: hlPercent(
                      tokenData.priceSOL, 
                      tokenData.low24h, 
                      tokenData.high24h
                    )
                  }} 
                />
              )}
            </div>
            <span>
              {loading ? (
                <span className="skeleton" style={{width: '80px', height: '12px'}}></span>
              ) : (
                `H: ${fmtPriceSOL(tokenData?.high24h || 0)}`
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="stats">
        <StatCard 
          label="Market Cap" 
          value={loading ? null : fmtCompact(tokenData?.marketCap || 0)}
          delta={loading ? null : tokenData?.marketCapDelta}
          loading={loading}
        />
        <StatCard 
          label="24h Volume" 
          value={loading ? null : fmtCompact(tokenData?.volume24h || 0)}
          delta={loading ? null : tokenData?.volumeDelta}
          loading={loading}
        />
        <StatCard 
          label="FDV" 
          value={loading ? null : fmtCompact(tokenData?.fdv || 0)}
          delta={loading ? null : tokenData?.fdvDelta}
          loading={loading}
        />
      </section>

      {/* Chart */}
      <div className="chart-bubble">
        <TokenChart contractAddress={contractAddress} />
      </div>
    </div>
  );
}

export default ContractPage;
