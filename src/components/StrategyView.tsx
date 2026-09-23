import { useState } from 'react';
import { EngineData } from '../types';
import { formatPnL, formatNumber, formatInteger } from '../lib/formatters';
import { Sliders, Cpu, GitFork, Gauge, CheckCircle2, Zap, Layers, RefreshCw } from 'lucide-react';

interface StrategyViewProps {
  data: EngineData | null;
  isConnected: boolean;
  onUpdateParams?: (params: { gamma?: number; spread?: number; size?: number; max_pos?: number; skew_factor?: number }) => void;
}

const STRATEGIES_METADATA = [
  {
    name: 'FixedSpreadMM',
    title: 'Fixed Spread Market Maker (Baseline)',
    badge: 'BASELINE',
    badgeColor: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    equation: 'P_bid = P_mid - (delta / 2),   P_ask = P_mid + (delta / 2)',
    description: 'Quotes constant half-spread around mid-price regardless of inventory accumulation or volatility regime.',
    riskExposure: 'High adverse selection during directional price trends.',
    bestRegime: 'Mean-reverting, low-volatility order flow with balanced buy/sell volume.',
  },
  {
    name: 'InventoryAware',
    title: 'Inventory-Aware Skew Market Maker',
    badge: 'SKEW ALPHA',
    badgeColor: 'bg-sky-950/40 text-sky-400 border-sky-800',
    equation: 'P_skewed = P_mid - (gamma * q),   delta_bid = (s/2) + q*kappa,   delta_ask = (s/2) - q*kappa',
    description: 'Dynamically shifts the quoting center away from accumulated inventory, attracting balancing flow.',
    riskExposure: 'Tolerates temporary spread widening to maintain neutral inventory.',
    bestRegime: 'Asymmetric order flows and trending markets with directional noise.',
  },
  {
    name: 'VolatilityAdaptive',
    title: 'Volatility-Adaptive Dynamic Spread MM',
    badge: 'VOLATILITY ALPHA',
    badgeColor: 'bg-amber-950/40 text-amber-400 border-amber-800',
    equation: 's(t) = s_0 * (1 + 10*sigma),   Q(t) = max(1, floor(Q_0 / (1 + 5*sigma)))',
    description: 'Expands quote spread and scales down quote sizes as microstructure volatility spikes.',
    riskExposure: 'Lower fill rates during extreme market volatility, protecting capital.',
    bestRegime: 'High micro-volatility regimes with frequent price jumps.',
  },
  {
    name: 'RegimeAdaptive',
    title: 'Regime-Adaptive Classifier MM',
    badge: 'MULTI-REGIME',
    badgeColor: 'bg-purple-950/40 text-purple-400 border-purple-800',
    equation: 'Regime(t) = VolAdaptive (if sigma_t > 0.0005) else FixedSpread',
    description: 'Continuously measures realized return volatility over a sliding window and swaps execution engines.',
    riskExposure: 'Optimal balance between spread capture during calm periods and capital preservation during shocks.',
    bestRegime: 'Non-stationary market environments with regime switches.',
  },
];

export default function StrategyView({ data, isConnected, onUpdateParams }: StrategyViewProps) {
  const currentStrategyName = data?.strategy?.name || 'FixedSpreadMM';
  const currentRegime = data?.strategy?.regime || 'NORMAL';
  const inventory = Number(data?.strategy?.inventory ?? 0);
  const spread = Number(data?.market?.spread ?? 0.1);
  const obi = Number(data?.market?.obi ?? 0);

  // Live Hot-Reloading parameters state
  const [gamma, setGamma] = useState(data?.risk?.gamma ?? 0.1);
  const [quotingSpread, setQuotingSpread] = useState(0.10);
  const [orderSize, setOrderSize] = useState(10);
  const [maxPosition, setMaxPosition] = useState(data?.risk?.max_exposure ?? 100);
  const [skewFactor, setSkewFactor] = useState(0.05);
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = (newGamma = gamma, newSpread = quotingSpread, newSize = orderSize, newMax = maxPosition, newSkew = skewFactor) => {
    if (onUpdateParams) {
      setIsApplying(true);
      onUpdateParams({
        gamma: Number(newGamma),
        spread: Number(newSpread),
        size: Number(newSize),
        max_pos: Number(newMax),
        skew_factor: Number(newSkew),
      });
      setTimeout(() => setIsApplying(false), 300);
    }
  };

  return (
    <div className="h-full flex flex-col gap-3 font-mono text-xs overflow-y-auto min-h-0 pr-1">
      {/* Header Info */}
      <div className="terminal-border p-3.5 bg-[#0d0d0d] flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="terminal-text text-neutral-200">STRATEGY TAXONOMY & PARAMETER SPECIFICATION</span>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Live quantitative calibrations, hot-reloading parameters without restarting engine, and execution metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-neutral-500 text-[10px] uppercase">Active Model:</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 font-bold">
            {currentStrategyName}
          </span>
        </div>
      </div>

      {/* Live Strategy Parameters Hot-Reloading Panel */}
      <div className="terminal-border p-4 bg-[#0e0e0e] space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span className="terminal-text text-neutral-200">LIVE PARAMETER HOT-RELOAD (STDIN IPC)</span>
          </div>
          <span className="text-[10px] text-neutral-400">Updates live without resetting determinism</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-1">
          {/* Risk Aversion Gamma */}
          <div className="bg-[#121212] p-3 rounded border border-[#222222] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Risk Aversion (γ)</span>
              <span className="text-emerald-400 font-bold tabular-nums">{gamma.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="1.0"
              step="0.01"
              value={gamma}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setGamma(val);
                handleApply(val, quotingSpread, orderSize, maxPosition, skewFactor);
              }}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-[#222] rounded"
            />
            <span className="text-[9px] text-neutral-500 mt-2">Avellaneda-Stoikov inventory penalty</span>
          </div>

          {/* Quoting Base Spread */}
          <div className="bg-[#121212] p-3 rounded border border-[#222222] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Base Spread (δ)</span>
              <span className="text-sky-400 font-bold tabular-nums">${quotingSpread.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.02"
              max="0.50"
              step="0.01"
              value={quotingSpread}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setQuotingSpread(val);
                handleApply(gamma, val, orderSize, maxPosition, skewFactor);
              }}
              className="w-full accent-sky-500 cursor-pointer h-1.5 bg-[#222] rounded"
            />
            <span className="text-[9px] text-neutral-500 mt-2">Fixed & Vol base quoting width</span>
          </div>

          {/* Quoting Order Size */}
          <div className="bg-[#121212] p-3 rounded border border-[#222222] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Quote Lot Size (Q)</span>
              <span className="text-amber-400 font-bold tabular-nums">{orderSize} units</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={orderSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setOrderSize(val);
                handleApply(gamma, quotingSpread, val, maxPosition, skewFactor);
              }}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#222] rounded"
            />
            <span className="text-[9px] text-neutral-500 mt-2">Nominal limit quote order size</span>
          </div>

          {/* Max Position Limit */}
          <div className="bg-[#121212] p-3 rounded border border-[#222222] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Inventory Cap (Q_max)</span>
              <span className="text-rose-400 font-bold tabular-nums">±{maxPosition}</span>
            </div>
            <input
              type="range"
              min="20"
              max="250"
              step="10"
              value={maxPosition}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setMaxPosition(val);
                handleApply(gamma, quotingSpread, orderSize, val, skewFactor);
              }}
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-[#222] rounded"
            />
            <span className="text-[9px] text-neutral-500 mt-2">Hard risk engine inventory breach</span>
          </div>

          {/* Skew Factor */}
          <div className="bg-[#121212] p-3 rounded border border-[#222222] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Skew Factor (κ)</span>
              <span className="text-purple-400 font-bold tabular-nums">{skewFactor.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.005"
              max="0.200"
              step="0.005"
              value={skewFactor}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setSkewFactor(val);
                handleApply(gamma, quotingSpread, orderSize, maxPosition, val);
              }}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-[#222] rounded"
            />
            <span className="text-[9px] text-neutral-500 mt-2">Inventory-aware center quote skew</span>
          </div>
        </div>
      </div>

      {/* Live Strategy Execution Telemetry */}
      <div className="terminal-border p-4 bg-[#0e0e0e] space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-neutral-400" />
            <span className="terminal-text text-neutral-200">LIVE ENGINE TELEMETRY</span>
          </div>
          <span className="text-[10px] text-neutral-500">Deterministic Step: {data?.step ?? 0}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
            <span className="text-[10px] text-neutral-500 uppercase block">Active Regime</span>
            <span className={`text-sm font-bold block mt-0.5 ${currentRegime === 'HIGH_VOL' ? 'text-amber-400' : 'text-emerald-400'}`}>
              {currentRegime}
            </span>
          </div>

          <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
            <span className="text-[10px] text-neutral-500 uppercase block">Quoting Spread</span>
            <span className="text-sm font-bold text-white tabular-nums block mt-0.5">
              ${formatNumber(spread, 4)}
            </span>
          </div>

          <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
            <span className="text-[10px] text-neutral-500 uppercase block">Current Inventory</span>
            <span className={`text-sm font-bold tabular-nums block mt-0.5 ${
              inventory > 0 ? 'text-emerald-400' : inventory < 0 ? 'text-rose-400' : 'text-neutral-300'
            }`}>
              {inventory > 0 ? `+${inventory}` : inventory} units
            </span>
          </div>

          <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
            <span className="text-[10px] text-neutral-500 uppercase block">Order Flow Bias (OBI)</span>
            <span className={`text-sm font-bold tabular-nums block mt-0.5 ${
              obi > 0 ? 'text-emerald-400' : obi < 0 ? 'text-rose-400' : 'text-neutral-300'
            }`}>
              {obi > 0 ? `+${obi.toFixed(3)}` : obi.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
        {STRATEGIES_METADATA.map((strat) => {
          const isActive = currentStrategyName === strat.name;
          return (
            <div
              key={strat.name}
              className={`p-4 rounded border transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-[#121412] border-emerald-500/60 shadow-md shadow-emerald-950/40'
                  : 'bg-[#0d0d0d] border-[#222222] opacity-80 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{strat.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isActive && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        ACTIVE
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${strat.badgeColor}`}>
                      {strat.badge}
                    </span>
                  </div>
                </div>

                <div className="mt-3 bg-black/60 p-2.5 rounded border border-[#1f1f1f] text-[11px] font-mono text-neutral-300">
                  <span className="text-[10px] text-neutral-500 block mb-0.5 uppercase tracking-wider">Formula:</span>
                  <code className="text-emerald-300">{strat.equation}</code>
                </div>

                <p className="text-[11px] text-neutral-400 mt-3 leading-relaxed">
                  {strat.description}
                </p>

                <div className="mt-3 space-y-1.5 text-[10px]">
                  <div className="flex gap-2">
                    <span className="text-neutral-500 min-w-[90px]">Risk Profile:</span>
                    <span className="text-neutral-300">{strat.riskExposure}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-neutral-500 min-w-[90px]">Optimal Target:</span>
                    <span className="text-neutral-300">{strat.bestRegime}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2.5 border-t border-[#1f1f1f] flex justify-between items-center text-[10px] text-neutral-500">
                <span>C++ Core: <code className="text-neutral-400">{strat.name}.cpp</code></span>
                <span>Hot-Reloadable via IPC STDIN</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
