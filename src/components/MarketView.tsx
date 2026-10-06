import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatPnL, formatNumber, formatInteger } from '../lib/formatters';
import { Activity, ShieldAlert, ShieldCheck, TrendingUp, Layers, Zap, Terminal, CheckCircle2, Download } from 'lucide-react';

interface MarketViewProps {
  data: any;
  history: any[];
  isConnected: boolean;
  auditLogs?: Array<{
    id: string;
    timestamp: string;
    category: string;
    action: string;
    plainLanguage: string;
    technicalDetails: string;
    outcome: string;
  }>;
}

export default function MarketView({ data, history, isConnected, auditLogs = [] }: MarketViewProps) {
  const [activeTab, setActiveTab] = useState<'CHART' | 'LOGS'>('CHART');

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `quant_audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const pnlMeta = useMemo(() => {
    return formatPnL(data?.performance?.total_pnl, 2);
  }, [data?.performance?.total_pnl]);

  // Order Book depth calculations
  const { asks, bids, maxLevelVolume, totalAskVolume, totalBidVolume } = useMemo(() => {
    const rawAsks: Array<{ price: number; quantity: number }> = data?.order_book?.asks || [];
    const rawBids: Array<{ price: number; quantity: number }> = data?.order_book?.bids || [];

    // Top 5 Asks sorted descending so lowest ask is at the bottom (closest to spread)
    const topAsks = rawAsks.slice(0, 5).slice().reverse();
    // Top 5 Bids sorted descending so highest bid is at the top (closest to spread)
    const topBids = rawBids.slice(0, 5);

    const askSum = topAsks.reduce((acc, a) => acc + (Number(a.quantity) || 0), 0);
    const bidSum = topBids.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0);

    const allQtys = [...topAsks.map((a) => a.quantity), ...topBids.map((b) => b.quantity)];
    const maxQty = Math.max(...allQtys, 1);

    return {
      asks: topAsks,
      bids: topBids,
      maxLevelVolume: maxQty,
      totalAskVolume: askSum,
      totalBidVolume: bidSum,
    };
  }, [data?.order_book]);

  const inventory = Number(data?.strategy?.inventory ?? 0);
  const exposure = Number(data?.risk?.exposure ?? 0);
  const maxExposure = Number(data?.risk?.max_exposure ?? 100);
  const exposurePct = Math.min(100, Math.round((exposure / Math.max(1, maxExposure)) * 100));

  const obi = Number(data?.market?.obi ?? 0);
  const spread = Number(data?.market?.spread ?? 0);
  const midPrice = Number(data?.market?.mid_price ?? 100);
  const volPct = (Number(data?.market?.volatility ?? 0) * 100).toFixed(2);

  return (
    <div className="h-full flex flex-col gap-3 font-mono text-xs overflow-hidden min-h-0">
      {/* Top 3 Metric Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0">
        
        {/* Panel 1: Market Ticker & Dynamics */}
        <div className="terminal-border p-3.5 flex flex-col justify-between overflow-y-auto min-h-0">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text">MARKET TICKER</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold">
                BTC / USD
              </span>
            </div>

            <div className="mt-3">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Mid Price</span>
              <div className="text-2xl font-bold tabular-nums text-white tracking-tight flex items-baseline gap-2">
                ${data?.market?.mid_price !== undefined ? formatNumber(midPrice, 2) : '---'}
                <span className="text-[10px] font-normal text-neutral-500">USD</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#1a1a1a]">
              <div className="bg-[#111111] p-2 rounded border border-[#222222]">
                <span className="text-[10px] text-neutral-500 uppercase block">Spread</span>
                <span className="text-sm font-semibold tabular-nums text-neutral-200">
                  {data?.market?.spread !== undefined ? formatNumber(spread, 4) : '---'}
                </span>
              </div>
              <div className="bg-[#111111] p-2 rounded border border-[#222222]">
                <span className="text-[10px] text-neutral-500 uppercase block">Micro-Vol</span>
                <span className="text-sm font-semibold tabular-nums text-neutral-200">
                  {data?.market?.volatility !== undefined ? `${volPct}%` : '---'}
                </span>
              </div>
            </div>

            {/* Order Book Imbalance (OBI) Gauge */}
            <div className="mt-3 bg-[#111111] p-2 rounded border border-[#222222]">
              <div className="flex justify-between items-center text-[10px] mb-1">
                <span className="text-neutral-500 uppercase">Order Flow Imbalance (OBI)</span>
                <span className={`tabular-nums font-semibold ${obi > 0 ? 'text-emerald-400' : obi < 0 ? 'text-rose-400' : 'text-neutral-400'}`}>
                  {obi > 0 ? `+${obi.toFixed(3)}` : obi.toFixed(3)}
                </span>
              </div>
              <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden flex">
                <div
                  className="bg-rose-500/80 transition-all duration-150"
                  style={{ width: `${Math.max(0, -obi) * 50}%` }}
                />
                <div className="w-0.5 bg-neutral-600 h-full" />
                <div
                  className="bg-emerald-500/80 transition-all duration-150 ml-auto"
                  style={{ width: `${Math.max(0, obi) * 50}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-neutral-600 mt-0.5">
                <span>Sell Pressure</span>
                <span>Buy Pressure</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#1a1a1a] flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">ENGINE STREAM</span>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                {isConnected ? 'LIVE (20ms)' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>

        {/* Panel 2: Order Book with Depth Visualizer */}
        <div className="terminal-border p-3.5 flex flex-col justify-between overflow-y-auto min-h-0">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text">ORDER BOOK (TOP 5)</span>
              </div>
              <span className="text-[10px] text-neutral-500">
                DEPTH: <span className="text-rose-400 tabular-nums">{totalAskVolume}</span> / <span className="text-emerald-400 tabular-nums">{totalBidVolume}</span>
              </span>
            </div>

            <div className="flex justify-between text-[10px] text-neutral-500 py-1.5 px-1 border-b border-[#1a1a1a]">
              <span>SIDE / PRICE</span>
              <span className="text-right">SIZE (SHARES)</span>
            </div>

            {/* Asks (Red) */}
            <div className="space-y-0.5 my-1">
              {asks.length > 0 ? (
                asks.map((ask, i) => {
                  const depthWidth = Math.min(100, Math.round((ask.quantity / maxLevelVolume) * 100));
                  return (
                    <div key={`ask-${i}`} className="relative flex justify-between items-center py-1 px-1.5 text-[11px] rounded overflow-hidden">
                      {/* Depth Bar Background */}
                      <div
                        className="absolute top-0 right-0 bottom-0 bg-rose-500/15 border-r border-rose-500/40 transition-all duration-150"
                        style={{ width: `${depthWidth}%` }}
                      />
                      <span className="relative z-10 font-semibold text-rose-400 tabular-nums">
                        ASK {ask.price.toFixed(2)}
                      </span>
                      <span className="relative z-10 text-neutral-300 tabular-nums font-mono font-medium">
                        {ask.quantity.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-2 text-center text-neutral-600 text-xs">Awaiting Asks...</div>
              )}
            </div>

            {/* Mid-Market / Spread Ribbon */}
            <div className="py-1 px-2 my-1 bg-[#141414] border-y border-[#262626] flex justify-between items-center text-[10px]">
              <span className="text-neutral-400">
                SPREAD: <span className="text-neutral-200 font-bold tabular-nums">{spread.toFixed(4)}</span>
              </span>
              <span className="text-neutral-400">
                MID: <span className="text-emerald-400 font-bold tabular-nums">${midPrice.toFixed(2)}</span>
              </span>
            </div>

            {/* Bids (Green) */}
            <div className="space-y-0.5 my-1">
              {bids.length > 0 ? (
                bids.map((bid, i) => {
                  const depthWidth = Math.min(100, Math.round((bid.quantity / maxLevelVolume) * 100));
                  return (
                    <div key={`bid-${i}`} className="relative flex justify-between items-center py-1 px-1.5 text-[11px] rounded overflow-hidden">
                      {/* Depth Bar Background */}
                      <div
                        className="absolute top-0 right-0 bottom-0 bg-emerald-500/15 border-r border-emerald-500/40 transition-all duration-150"
                        style={{ width: `${depthWidth}%` }}
                      />
                      <span className="relative z-10 font-semibold text-emerald-400 tabular-nums">
                        BID {bid.price.toFixed(2)}
                      </span>
                      <span className="relative z-10 text-neutral-300 tabular-nums font-mono font-medium">
                        {bid.quantity.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-2 text-center text-neutral-600 text-xs">Awaiting Bids...</div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 text-right pt-1">
            Top of Book Dynamic Depth Gauges
          </div>
        </div>

        {/* Panel 3: Strategy & Risk State */}
        <div className="terminal-border p-3.5 flex flex-col justify-between overflow-y-auto min-h-0">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text">STRATEGY & RISK</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 font-semibold">
                {data?.strategy?.name || 'FixedSpreadMM'}
              </span>
            </div>

            {/* Strategy Specs */}
            <div className="space-y-2 mt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500">Market Regime:</span>
                <span className="text-neutral-200 font-semibold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  {data?.strategy?.regime || 'NORMAL'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500">MM Inventory:</span>
                <span className={`tabular-nums font-bold px-2 py-0.5 rounded ${
                  inventory > 0 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' :
                  inventory < 0 ? 'bg-rose-950/40 text-rose-400 border border-rose-900/50' :
                  'bg-neutral-900 text-neutral-400 border border-neutral-800'
                }`}>
                  {inventory > 0 ? `+${inventory}` : inventory} units
                </span>
              </div>

              {/* Exposure Progress Gauge */}
              <div className="bg-[#111111] p-2.5 rounded border border-[#222222] mt-2">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-neutral-400">Risk Exposure:</span>
                  <span className="tabular-nums font-semibold text-neutral-200">
                    {exposure} / {maxExposure} ({exposurePct}%)
                  </span>
                </div>
                <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      exposurePct > 80 ? 'bg-rose-500' : exposurePct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${exposurePct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-[#111111] p-2 rounded border border-[#222222]">
                  <span className="text-[10px] text-neutral-500 uppercase block">Total Trades</span>
                  <span className="text-sm font-bold tabular-nums text-white">
                    {formatInteger(data?.performance?.trades_count)}
                  </span>
                </div>
                <div className="bg-[#111111] p-2 rounded border border-[#222222]">
                  <span className="text-[10px] text-neutral-500 uppercase block">Volume Traded</span>
                  <span className="text-sm font-bold tabular-nums text-white">
                    {formatInteger(data?.performance?.volume_traded)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs pt-1 border-t border-[#1a1a1a]">
                <span className="text-neutral-500">Max Drawdown:</span>
                <span className="tabular-nums text-amber-400 font-semibold">
                  {formatNumber(data?.performance?.max_drawdown, 2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#1a1a1a] flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">RISK ENGINE STATUS</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ALLOWED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Live Performance Chart or Audit Trail Logs */}
      <div className="terminal-border p-3.5 flex flex-col h-64 md:h-72 min-h-[200px]">
        <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#141414] p-0.5 rounded border border-[#222222]">
              <button
                onClick={() => setActiveTab('CHART')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded transition-all cursor-pointer ${
                  activeTab === 'CHART'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>LIVE METRICS (CHART)</span>
              </button>
              <button
                onClick={() => setActiveTab('LOGS')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded transition-all cursor-pointer ${
                  activeTab === 'LOGS'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Terminal className="w-3 h-3 text-sky-400" />
                <span>AUDIT TRAIL & PLAIN-LANGUAGE LOGS ({auditLogs.length})</span>
              </button>
            </div>
          </div>
          {activeTab === 'CHART' ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-neutral-500">TOTAL P&L:</span>
                <span className={`tabular-nums text-sm ${pnlMeta.colorClass}`}>
                  {pnlMeta.text} USD
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-neutral-400 ml-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 bg-emerald-500 inline-block rounded-sm" />
                  <span>P&L (Left)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 bg-sky-400 inline-block rounded-sm" />
                  <span>Inventory (Right)</span>
                </span>
              </div>
            </div>
          ) : auditLogs.length > 0 ? (
            <button
              onClick={handleExportLogs}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-semibold transition-all cursor-pointer border border-neutral-700"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>EXPORTER LES LOGS (JSON)</span>
            </button>
          ) : null}
        </div>

        <div className="flex-1 w-full mt-2 min-h-0 overflow-hidden flex flex-col">
          {activeTab === 'CHART' ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 25, bottom: 5, left: -5 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#1f1f1f" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#404040"
                  tick={{ fill: '#737373', fontSize: 10, fontFamily: 'monospace' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#404040"
                  tick={{ fill: '#10b981', fontSize: 10, fontFamily: 'monospace' }}
                  domain={['auto', 'auto']}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => Number(v).toFixed(1)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#404040"
                  tick={{ fill: '#38bdf8', fontSize: 10, fontFamily: 'monospace' }}
                  domain={['auto', 'auto']}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => Math.round(Number(v)).toString()}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0d0d0d',
                    borderColor: '#262626',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    padding: '6px 10px',
                  }}
                  formatter={(value: any, name: any) => {
                    const num = Number(value);
                    if (name === 'PnL') return [`${num.toFixed(2)} USD`, 'P&L'];
                    return [`${num} units`, 'Inventory'];
                  }}
                  labelFormatter={(label) => `Step: ${label}`}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="pnl"
                  name="PnL"
                  stroke="#10b981"
                  strokeWidth={1.75}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="stepAfter"
                  dataKey="inventory"
                  name="Inventory"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {auditLogs.length === 0 ? (
                <div className="text-center text-neutral-500 py-8">Aucun journal d'activité récent.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="bg-[#111111] p-2.5 rounded border border-[#222222] hover:border-neutral-700 transition-all">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-neutral-900 border border-neutral-800 text-neutral-300">
                          {log.category}
                        </span>
                        <span className="font-bold text-white">{log.action}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 tabular-nums">{log.timestamp}</span>
                    </div>

                    {/* Plain Language explanation for non-technical users */}
                    <div className="text-neutral-300 text-[11px] mt-1 bg-neutral-900/60 p-2 rounded border border-neutral-800/60 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-neutral-500 text-[10px] uppercase font-semibold block mb-0.5">Explication (Tous publics) :</span>
                        <span>{log.plainLanguage}</span>
                      </div>
                    </div>

                    {/* Technical details & outcome */}
                    <div className="mt-2 pt-2 border-t border-[#1a1a1a] grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-neutral-500 uppercase block">Détail Technique :</span>
                        <code className="text-sky-400 font-mono bg-neutral-950 px-1.5 py-0.5 rounded block mt-0.5 truncate">{log.technicalDetails}</code>
                      </div>
                      <div>
                        <span className="text-neutral-500 uppercase block">Résultat / Débouché :</span>
                        <span className="text-emerald-400 font-semibold block mt-0.5">{log.outcome}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
