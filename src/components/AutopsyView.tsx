import { useMemo } from 'react';
import { EngineData } from '../types';
import { formatPnL, formatNumber, formatInteger } from '../lib/formatters';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Compass,
  TrendingDown,
  Gauge,
  Hourglass,
  Scale
} from 'lucide-react';

interface AutopsyViewProps {
  data: EngineData | null;
  history: Array<{ time: number; pnl: number; inventory: number; mid: number }>;
  isConnected: boolean;
}

export default function AutopsyView({ data, history, isConnected }: AutopsyViewProps) {
  const risk = data?.risk;
  const perf = data?.performance;
  const market = data?.market;
  const strategy = data?.strategy;

  const inventory = Number(risk?.inventory ?? strategy?.inventory ?? 0);
  const maxExposure = Number(risk?.max_exposure ?? 100);
  const exposurePct = Math.min(100, Math.round((Math.abs(inventory) / Math.max(1, maxExposure)) * 100));
  
  const midPrice = Number(market?.mid_price ?? 100);
  const reservationPrice = Number(risk?.reservation_price ?? midPrice);
  const reservationSkew = reservationPrice - midPrice;
  const var95 = Number(risk?.var_95 ?? 0);
  const gamma = Number(risk?.gamma ?? 0.1);
  const meanLatency = Number(risk?.mean_latency_ms ?? 5.0);
  const jitterStd = Number(risk?.jitter_stddev_ms ?? 2.0);
  const inflightOrders = Number(risk?.latency_pending ?? 0);

  // Advanced High-Frequency Quant Metrics
  const adverseSelection = Number(perf?.adverse_selection ?? risk?.adverse_selection ?? 0);
  const sortinoRatio = Number(perf?.sortino_ratio ?? risk?.sortino_ratio ?? 0);
  const inventoryHalfLife = Number(perf?.inventory_half_life ?? risk?.inventory_half_life ?? 0);

  const makerRebates = Number(perf?.maker_rebates ?? 0);
  const takerFees = Number(perf?.taker_fees ?? 0);
  const netFees = Number(perf?.net_fees ?? (makerRebates - takerFees));
  const maxDrawdown = Number(perf?.max_drawdown ?? 0);
  const totalPnl = Number(perf?.total_pnl ?? 0);
  const pnlMeta = formatPnL(totalPnl, 2);

  const isBreached = risk?.breach || Math.abs(inventory) >= maxExposure;
  const isKilled = risk?.status === 'KILLED';

  // Adverse selection estimation based on recent drawdown vs informed trading
  const adverseSelectionStatus = useMemo(() => {
    if (adverseSelection > 0.04 || (exposurePct > 80 && totalPnl < 0)) {
      return { level: 'SEVERE', text: `Toxic flow detected (${adverseSelection.toFixed(4)} USD adverse drift). Large inventory accumulated against adverse trend.`, color: 'text-rose-400 bg-rose-950/30 border-rose-800' };
    }
    if (adverseSelection > 0.015 || Math.abs(reservationSkew) > 0.05) {
      return { level: 'ELEVATED', text: `Significant price impact (${adverseSelection.toFixed(4)} USD). Reservation price skew applied to ward off informed takers.`, color: 'text-amber-400 bg-amber-950/30 border-amber-800' };
    }
    return { level: 'NOMINAL', text: `Order flow balanced (${adverseSelection.toFixed(4)} USD drift). Symmetric two-sided liquidity execution.`, color: 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40' };
  }, [adverseSelection, exposurePct, totalPnl, reservationSkew]);

  return (
    <div className="h-full flex flex-col gap-3 font-mono text-xs overflow-y-auto min-h-0 pr-1">
      {/* Top Banner: Engine Health & Risk Breaches */}
      <div className={`p-3 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isKilled
          ? 'bg-rose-950/40 border-rose-700 text-rose-300'
          : isBreached
          ? 'bg-amber-950/30 border-amber-700 text-amber-300'
          : 'bg-[#0f0f0f] border-[#222222] text-neutral-300'
      }`}>
        <div className="flex items-center gap-2.5">
          {isKilled ? (
            <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse flex-shrink-0" />
          ) : isBreached ? (
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          )}
          <div>
            <div className="font-bold text-sm tracking-wide text-white flex items-center gap-2">
              RISK ENGINE AUTOPSY & MICROSTRUCTURE AUDIT
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                isKilled
                  ? 'bg-rose-900 text-white'
                  : isBreached
                  ? 'bg-amber-900 text-amber-200'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}>
                STATUS: {risk?.status || (isBreached ? 'BREACH' : 'NORMAL')}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Real-time monitoring of Value-at-Risk (VaR 95%), Avellaneda-Stoikov skew, Sortino ratio, adverse selection, and inventory half-life.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-neutral-500">ENGINE IPC:</span>
          <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/60">
            STDIO PIPE (ACTIVE)
          </span>
        </div>
      </div>

      {/* Grid: Core Quantitative & Risk Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Module 1: VaR 95% Parametric */}
        <div className="terminal-border p-3.5 bg-[#0d0d0d] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text text-neutral-200">VALUE AT RISK (VaR 95%)</span>
              </div>
              <span className="text-[10px] text-neutral-500">1.645·σ·S·|q|</span>
            </div>
            <div className="mt-3">
              <span className="text-[10px] text-neutral-500 uppercase block">1-Step Parametric VaR</span>
              <div className="text-2xl font-bold tabular-nums text-amber-400 mt-0.5">
                ${formatNumber(var95, 3)}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-neutral-400 space-y-1">
              <div className="flex justify-between">
                <span>Microstructure Vol (σ):</span>
                <span className="text-white font-mono">{formatNumber(market?.volatility ?? 0, 5)}</span>
              </div>
              <div className="flex justify-between">
                <span>Confidence Level:</span>
                <span className="text-neutral-300">95.0% (1-tailed)</span>
              </div>
              <div className="flex justify-between">
                <span>Active Capital Exposure:</span>
                <span className="text-white">${formatNumber(Math.abs(inventory) * midPrice, 2)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#1a1a1a] text-[10px] text-neutral-500">
            Statistical downside threshold under standard Brownian increments.
          </div>
        </div>

        {/* Module 2: Avellaneda-Stoikov Skew */}
        <div className="terminal-border p-3.5 bg-[#0d0d0d] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text text-neutral-200">AVELLANEDA-STOIKOV</span>
              </div>
              <span className="text-[10px] text-neutral-500">γ = {gamma}</span>
            </div>
            <div className="mt-3">
              <span className="text-[10px] text-neutral-500 uppercase block">Reservation Price r(s, q)</span>
              <div className="text-2xl font-bold tabular-nums text-emerald-400 mt-0.5">
                ${formatNumber(reservationPrice, 3)}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-neutral-400 space-y-1">
              <div className="flex justify-between">
                <span>Raw Mid Price (s):</span>
                <span className="text-white">${formatNumber(midPrice, 3)}</span>
              </div>
              <div className="flex justify-between">
                <span>Inventory Skew (Δ):</span>
                <span className={`font-semibold ${reservationSkew > 0 ? 'text-emerald-400' : reservationSkew < 0 ? 'text-rose-400' : 'text-neutral-300'}`}>
                  {reservationSkew >= 0 ? `+${reservationSkew.toFixed(4)}` : reservationSkew.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Risk Aversion (γ):</span>
                <span className="text-neutral-300">{gamma}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#1a1a1a] text-[10px] text-neutral-500">
            Formula: r(s,q) = s - q · γ · σ² · (T - t)
          </div>
        </div>

        {/* Module 3: Maker Rebates vs Taker Fees */}
        <div className="terminal-border p-3.5 bg-[#0d0d0d] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text text-neutral-200">FEE MICROSTRUCTURE</span>
              </div>
              <span className="text-[10px] text-neutral-500">+1bps / -2bps</span>
            </div>
            <div className="mt-3">
              <span className="text-[10px] text-neutral-500 uppercase block">Net Liquidity Fees</span>
              <div className={`text-2xl font-bold tabular-nums mt-0.5 ${netFees >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netFees >= 0 ? `+${netFees.toFixed(4)}` : netFees.toFixed(4)}{' '}
                <span className="text-[10px] font-normal text-neutral-500">USD</span>
              </div>
            </div>
            <div className="mt-3 text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-400">Maker Rebates (+0.01%):</span>
                <span className="text-emerald-400 font-semibold tabular-nums">+${formatNumber(makerRebates, 4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Taker Fees (-0.02%):</span>
                <span className="text-rose-400 font-semibold tabular-nums">-${formatNumber(takerFees, 4)}</span>
              </div>
              <div className="flex justify-between border-t border-[#1a1a1a] pt-1">
                <span className="text-neutral-400">Total Volume:</span>
                <span className="text-white font-mono">{formatInteger(perf?.volume_traded)} shares</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#1a1a1a] text-[10px] text-neutral-500">
            Real institutional exchange fee tiers simulation.
          </div>
        </div>

        {/* Module 4: High-Frequency Alpha Metrics */}
        <div className="terminal-border p-3.5 bg-[#0d0d0d] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text text-neutral-200">HF PERFORMANCE METRICS</span>
              </div>
              <span className="text-[10px] text-neutral-500">Sortino & Toxicity</span>
            </div>
            <div className="mt-3">
              <span className="text-[10px] text-neutral-500 uppercase block">Annualized Sortino Ratio</span>
              <div className="text-2xl font-bold tabular-nums text-purple-400 mt-0.5">
                {sortinoRatio.toFixed(2)}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-neutral-400 space-y-1">
              <div className="flex justify-between">
                <span>Adverse Selection Drift:</span>
                <span className={`font-semibold ${adverseSelection > 0.02 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ${adverseSelection.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Inventory Half-Life (t½):</span>
                <span className="text-sky-400 font-semibold">{inventoryHalfLife.toFixed(1)} steps</span>
              </div>
              <div className="flex justify-between">
                <span>Mean Latency / In-flight:</span>
                <span className="text-white font-mono">{meanLatency.toFixed(1)}ms / {inflightOrders} ord</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#1a1a1a] text-[10px] text-neutral-500">
            Downside semi-variance risk adjustment & decay.
          </div>
        </div>
      </div>

      {/* Detailed Analysis Section: Adverse Selection & Risk Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-[220px]">
        {/* Adverse Selection & Flow Toxicity Card */}
        <div className="terminal-border p-4 bg-[#0e0e0e] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text text-neutral-200">ADVERSE SELECTION & TOXIC FLOW MONITOR</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${adverseSelectionStatus.color}`}>
                {adverseSelectionStatus.level}
              </span>
            </div>
            
            <p className="text-[11px] text-neutral-400 mt-2">
              {adverseSelectionStatus.text}
            </p>

            <div className="space-y-2 mt-4">
              <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-400">Inventory Utilization / Saturation:</span>
                  <span className="font-semibold tabular-nums text-white">
                    {Math.abs(inventory)} / {maxExposure} ({exposurePct}%)
                  </span>
                </div>
                <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full transition-all duration-200 ${
                      exposurePct > 80 ? 'bg-rose-500' : exposurePct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${exposurePct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="bg-[#121212] p-2 rounded border border-[#222222]">
                  <span className="text-neutral-500 text-[10px] block">ADVERSE DRIFT</span>
                  <span className={`font-bold tabular-nums text-sm ${adverseSelection > 0.02 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ${adverseSelection.toFixed(4)}
                  </span>
                </div>
                <div className="bg-[#121212] p-2 rounded border border-[#222222]">
                  <span className="text-neutral-500 text-[10px] block">MAX DRAWDOWN</span>
                  <span className="font-bold text-amber-400 tabular-nums text-sm">
                    {formatNumber(maxDrawdown, 2)} USD
                  </span>
                </div>
                <div className="bg-[#121212] p-2 rounded border border-[#222222]">
                  <span className="text-neutral-500 text-[10px] block">SORTINO RATIO</span>
                  <span className="font-bold text-purple-400 tabular-nums text-sm">
                    {sortinoRatio.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 pt-2 border-t border-[#1a1a1a] mt-3">
            Informed taker momentum traders cause adverse selection by consuming resting liquidity right before directional price shocks.
          </div>
        </div>

        {/* Microstructure Risk Limits & Kill Switch Rule */}
        <div className="terminal-border p-4 bg-[#0e0e0e] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text text-neutral-200">RISK ENGINE THRESHOLDS & INVARIANTS</span>
              </div>
              <span className="text-[10px] text-neutral-500">C++ Hard Limits</span>
            </div>

            <div className="space-y-2 mt-3 text-[11px]">
              <div className="flex justify-between items-center p-2 rounded bg-[#121212] border border-[#222222]">
                <span className="text-neutral-400">Position Hard Limit (Max Exposure):</span>
                <span className="text-white font-mono font-semibold">±{maxExposure} units</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-[#121212] border border-[#222222]">
                <span className="text-neutral-400">Current Market Maker Position:</span>
                <span className={`font-mono font-bold ${
                  inventory > 0 ? 'text-emerald-400' : inventory < 0 ? 'text-rose-400' : 'text-neutral-300'
                }`}>
                  {inventory > 0 ? `+${inventory}` : inventory} units
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-[#121212] border border-[#222222]">
                <span className="text-neutral-400">Inventory Half-Life Decay:</span>
                <span className="text-sky-400 font-mono font-semibold">
                  {inventoryHalfLife > 0 ? `${inventoryHalfLife.toFixed(1)} steps` : 'Calculating...'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-[#121212] border border-[#222222]">
                <span className="text-neutral-400">Kill-Switch Circuit Breaker:</span>
                <span className={`font-mono font-semibold ${isKilled ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isKilled ? 'ACTIVATED (HALTED)' : 'DISARMED (ACTIVE QUOTING)'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 pt-2 border-t border-[#1a1a1a] mt-3">
            Orders increasing inventory beyond ±{maxExposure} units are rejected immediately by the C++ RiskEngine before transmission to the matching engine.
          </div>
        </div>
      </div>
    </div>
  );
}
