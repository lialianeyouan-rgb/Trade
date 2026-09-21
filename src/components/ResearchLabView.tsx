import { useState, useEffect, useMemo } from 'react';
import { formatPnL, formatNumber, formatInteger } from '../lib/formatters';
import { ExperimentRun, ExperimentResults } from '../types';
import {
  Play,
  Loader2,
  Sliders,
  CheckCircle2,
  FlaskConical,
  BarChart3,
  Clock,
  Sparkles,
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  Database
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

interface ResearchLabViewProps {
  onStartExperiment: (params: { strategy: string; seed: number; duration: number; replay?: string }) => void;
  lastExperiment: {
    strategy: string;
    seed: number;
    duration: number;
    results: ExperimentResults;
  } | null;
  isConnected: boolean;
  isSimulating: boolean;
  setHistory?: any;
}

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  FixedSpreadMM: 'Baseline strategy placing symmetric bid/ask limit quotes around mid-price with constant half-spread.',
  InventoryAware: 'Skews order placement asymmetric to inventory to actively prevent inventory buildup and toxic flow.',
  VolatilityAdaptive: 'Expands quoting spread during high microstructure volatility and tightens in calm conditions.',
  RegimeAdaptive: 'Classifier-driven strategy shifting quoting parameters according to market volatility regimes.',
};

export default function ResearchLabView({
  onStartExperiment,
  lastExperiment,
  isConnected,
  isSimulating,
  setHistory,
}: ResearchLabViewProps) {
  const [strategy, setStrategy] = useState('FixedSpreadMM');
  const [seed, setSeed] = useState(42);
  const [duration, setDuration] = useState(100);
  const [dataSource, setDataSource] = useState<'SYNTHETIC' | 'CSV_REPLAY'>('SYNTHETIC');
  const [replayFilePath, setReplayFilePath] = useState('cpp/sample_l2_replay.csv');

  const [completionToast, setCompletionToast] = useState<{
    text: string;
    seed: number;
    steps: number;
    pnl: number;
  } | null>(null);
  const [experimentsHistory, setExperimentsHistory] = useState<ExperimentRun[]>([]);
  const [activeTab, setActiveTab] = useState<'runs' | 'compare'>('runs');

  useEffect(() => {
    if (lastExperiment && lastExperiment.results) {
      const newEntry: ExperimentRun = {
        id: `RUN-${Date.now().toString().slice(-4)}`,
        strategy: lastExperiment.strategy,
        seed: lastExperiment.seed,
        duration: lastExperiment.duration,
        results: lastExperiment.results,
        timestamp: new Date().toLocaleTimeString(),
      };
      setExperimentsHistory((prev) => [newEntry, ...prev.slice(0, 19)]);
      setCompletionToast({
        text: `Experiment executed successfully (${lastExperiment.strategy}, Seed: ${lastExperiment.seed})`,
        seed: lastExperiment.seed,
        steps: lastExperiment.duration,
        pnl: lastExperiment.results.pnl,
      });
    }
  }, [lastExperiment]);

  const handleRun = () => {
    if (setHistory) setHistory([]);
    setCompletionToast(null);
    onStartExperiment({
      strategy,
      seed,
      duration,
      replay: dataSource === 'CSV_REPLAY' ? replayFilePath : undefined,
    });
  };

  const handleApplyPreset = (s: string, sd: number, dur: number) => {
    setStrategy(s);
    setSeed(sd);
    setDuration(dur);
    setDataSource('SYNTHETIC');
  };

  // CSV Export Function
  const exportToCSV = () => {
    if (experimentsHistory.length === 0) return;

    const headers = [
      'RunID',
      'Timestamp',
      'Strategy',
      'Seed',
      'Steps',
      'TotalPnL_USD',
      'RealizedPnL_USD',
      'UnrealizedPnL_USD',
      'MakerRebates_USD',
      'TakerFees_USD',
      'NetFees_USD',
      'MaxDrawdown_USD',
      'SortinoRatio',
      'AdverseSelection_USD',
      'InventoryHalfLife',
      'TradesCount',
      'VolumeTraded',
      'FinalInventory',
      'VaR_95'
    ];

    const rows = experimentsHistory.map((run) => {
      const r = run.results;
      return [
        run.id,
        run.timestamp,
        `"${run.strategy}"`,
        run.seed,
        run.duration,
        r.pnl.toFixed(4),
        (r.realized_pnl ?? 0).toFixed(4),
        (r.unrealized_pnl ?? 0).toFixed(4),
        (r.maker_rebates ?? 0).toFixed(4),
        (r.taker_fees ?? 0).toFixed(4),
        (r.net_fees ?? 0).toFixed(4),
        r.max_drawdown.toFixed(4),
        (r.sortino_ratio ?? 0).toFixed(2),
        (r.adverse_selection ?? 0).toFixed(4),
        (r.inventory_half_life ?? 0).toFixed(1),
        r.trades_count,
        r.volume_traded,
        r.final_inventory ?? 0,
        (r.var_95 ?? 0).toFixed(4)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `quant_market_making_runs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSON Export Function
  const exportToJSON = () => {
    if (experimentsHistory.length === 0) return;
    const jsonString = JSON.stringify(experimentsHistory, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `quant_market_making_runs_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Comparative Data for Recharts BarChart
  const comparativeChartData = useMemo(() => {
    return experimentsHistory.slice(0, 10).reverse().map((run) => ({
      name: `${run.strategy.replace('MM', '')} (${run.seed})`,
      strategy: run.strategy,
      pnl: Number(run.results.pnl.toFixed(2)),
      drawdown: Number(run.results.max_drawdown.toFixed(2)),
      sortino: Number((run.results.sortino_ratio ?? 0).toFixed(2)),
      adverse: Number((run.results.adverse_selection ?? 0).toFixed(4)),
      netFees: Number((run.results.net_fees ?? 0).toFixed(3)),
    }));
  }, [experimentsHistory]);

  const lastPnl = lastExperiment ? formatPnL(lastExperiment.results.pnl, 4) : null;

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-xs overflow-y-auto min-h-0 pr-1">
      {/* Top Header Card */}
      <div className="terminal-border p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#0d0d0d]">
        <div className="flex items-center gap-2.5">
          <FlaskConical className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div>
            <span className="terminal-text text-neutral-200">QUANTITATIVE RESEARCH LAB</span>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Deterministic microstructure backtesting, L2 market data replay, and quantitative alpha benchmarking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {experimentsHistory.length > 0 && (
            <div className="flex items-center gap-1.5 mr-2">
              <button
                type="button"
                onClick={exportToCSV}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1a1a1a] hover:bg-[#252525] border border-[#2e2e2e] text-neutral-300 hover:text-white cursor-pointer transition-colors text-[10px]"
                title="Export runs to CSV format"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                <span>EXPORT CSV</span>
              </button>
              <button
                type="button"
                onClick={exportToJSON}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1a1a1a] hover:bg-[#252525] border border-[#2e2e2e] text-neutral-300 hover:text-white cursor-pointer transition-colors text-[10px]"
                title="Export runs to JSON format"
              >
                <FileJson className="w-3 h-3 text-sky-400" />
                <span>EXPORT JSON</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-neutral-500">ENGINE STATUS:</span>
            <span className={`font-bold px-2 py-0.5 rounded border ${
              isConnected
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60'
                : 'bg-rose-950/40 text-rose-400 border-rose-900/60'
            }`}>
              {isConnected ? 'READY' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Completion Toast Notification */}
      {completionToast && (
        <div className="border border-emerald-500/40 bg-emerald-950/20 p-3 rounded flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-emerald-300 font-bold">{completionToast.text}</span>
              <span className="text-neutral-400 ml-2">
                P&L:{' '}
                <span className={completionToast.pnl >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {completionToast.pnl >= 0 ? `+${completionToast.pnl.toFixed(4)}` : completionToast.pnl.toFixed(4)} USD
                </span>
              </span>
            </div>
          </div>
          <button
            onClick={() => setCompletionToast(null)}
            className="text-neutral-500 hover:text-white px-2 py-0.5 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Configuration & Controls Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form Panel */}
        <div className="lg:col-span-2 terminal-border p-4 bg-[#0e0e0e] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-neutral-400" />
              <span className="terminal-text">SIMULATION PARAMETERS</span>
            </div>
            <span className="text-[10px] text-neutral-500">C++ Deterministic Engine</span>
          </div>

          <div className="space-y-3.5">
            {/* Strategy Select */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-neutral-400 uppercase text-[11px]">Quoting Algorithm:</label>
                <span className="text-[10px] text-neutral-500">{strategy}</span>
              </div>
              <select
                className="w-full bg-black border border-[#2e2e2e] focus:border-emerald-500 text-neutral-100 p-2 rounded text-xs focus:outline-none transition-colors"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                <option value="FixedSpreadMM">FixedSpreadMM (Constant Half-Spread)</option>
                <option value="InventoryAware">InventoryAwareMM (Skewed Quotes by Inventory)</option>
                <option value="VolatilityAdaptive">VolatilityAdaptiveMM (Dynamic Spread on Micro-Vol)</option>
                <option value="RegimeAdaptive">RegimeAdaptiveMM (Market Regime Switching)</option>
              </select>
              <p className="text-[10px] text-neutral-500 mt-1 italic">
                {STRATEGY_DESCRIPTIONS[strategy]}
              </p>
            </div>

            {/* Data Source Selector: Synthetic vs L2 CSV Replay */}
            <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-neutral-300 font-semibold uppercase text-[11px] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  Market Data Feed Provider:
                </label>
                <div className="flex bg-[#1a1a1a] p-0.5 rounded border border-[#2a2a2a]">
                  <button
                    type="button"
                    onClick={() => setDataSource('SYNTHETIC')}
                    className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                      dataSource === 'SYNTHETIC' ? 'bg-emerald-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    SYNTHETIC PRNG
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataSource('CSV_REPLAY')}
                    className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                      dataSource === 'CSV_REPLAY' ? 'bg-sky-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    CSV L2 REPLAY
                  </button>
                </div>
              </div>

              {dataSource === 'CSV_REPLAY' ? (
                <div className="mt-2 space-y-1">
                  <input
                    type="text"
                    value={replayFilePath}
                    onChange={(e) => setReplayFilePath(e.target.value)}
                    className="w-full bg-black border border-[#2e2e2e] focus:border-sky-500 text-neutral-100 p-1.5 rounded text-xs font-mono"
                    placeholder="/cpp/sample_l2_replay.csv"
                  />
                  <span className="text-[10px] text-sky-400 block">
                    Replays historical L2 quotes & cancellations from CSV via CSVMarketDataReader.
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-neutral-500 block">
                  Simulates realistic Poisson noise flow with &gt;80% quote cancellations and momentum sweeps.
                </span>
              )}
            </div>

            {/* Seed and Duration Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-neutral-400 uppercase text-[11px]">RNG Seed:</label>
                  <span className="text-[10px] text-neutral-500">uint64_t</span>
                </div>
                <input
                  type="number"
                  className="w-full bg-black border border-[#2e2e2e] focus:border-emerald-500 text-neutral-100 p-2 rounded text-xs tabular-nums focus:outline-none transition-colors"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setSeed(42)}
                    className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] text-neutral-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    Seed 42
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeed(1337)}
                    className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] text-neutral-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    Seed 1337
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeed(Math.floor(Math.random() * 90000) + 1000)}
                    className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] text-neutral-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    Randomize
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-neutral-400 uppercase text-[11px]">Duration (Order Steps):</label>
                  <span className="text-[10px] text-neutral-500">{duration === 0 ? 'Infinite Live' : `${duration} steps`}</span>
                </div>
                <input
                  type="number"
                  className="w-full bg-black border border-[#2e2e2e] focus:border-emerald-500 text-neutral-100 p-2 rounded text-xs tabular-nums focus:outline-none transition-colors"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setDuration(100)}
                    className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] text-neutral-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    100 (Fast)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration(500)}
                    className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] text-neutral-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    500 (Std)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration(2000)}
                    className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] text-neutral-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    2000 (Deep)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration(0)}
                    className="text-[10px] bg-[#1a1a1a] hover:bg-[#252525] text-neutral-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    Live (0)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#222222] flex items-center justify-between">
            <button
              onClick={handleRun}
              disabled={!isConnected || isSimulating}
              className={`flex items-center gap-2 px-6 py-2.5 rounded font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                isSimulating
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 cursor-not-allowed'
                  : !isConnected
                  ? 'bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-black border border-emerald-400 shadow-md shadow-emerald-950'
              }`}
            >
              {isSimulating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>RUNNING SIMULATION...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>RUN EXPERIMENT</span>
                </>
              )}
            </button>

            <span className="text-[11px] text-neutral-500">
              {duration === 0 ? 'Mode: Continuous Market Stream' : 'Mode: Batch Deterministic Backtest'}
            </span>
          </div>
        </div>

        {/* Quick Presets & Edge Cases */}
        <div className="terminal-border p-4 bg-[#0e0e0e] flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-1.5 pb-2 border-b border-[#222222]">
              <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
              <span className="terminal-text">BENCHMARK PRESETS</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              Select standard quant benchmark scenarios to compare algorithms under equal market conditions:
            </p>

            <div className="space-y-2 mt-3">
              <button
                type="button"
                onClick={() => handleApplyPreset('FixedSpreadMM', 42, 500)}
                className="w-full text-left p-2 rounded bg-[#131313] hover:bg-[#1a1a1a] border border-[#222222] transition-colors cursor-pointer"
              >
                <div className="font-semibold text-neutral-200 text-[11px]">Standard Baseline (FixedSpread)</div>
                <div className="text-[10px] text-neutral-500">Seed: 42 | Steps: 500 | Gaussian Noise</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('InventoryAware', 42, 500)}
                className="w-full text-left p-2 rounded bg-[#131313] hover:bg-[#1a1a1a] border border-[#222222] transition-colors cursor-pointer"
              >
                <div className="font-semibold text-neutral-200 text-[11px]">Inventory Skew Control</div>
                <div className="text-[10px] text-neutral-500">Seed: 42 | Steps: 500 | Auto-inventory rebalancing</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('VolatilityAdaptive', 1337, 500)}
                className="w-full text-left p-2 rounded bg-[#131313] hover:bg-[#1a1a1a] border border-[#222222] transition-colors cursor-pointer"
              >
                <div className="font-semibold text-neutral-200 text-[11px]">Stress Test: High Volatility Spike</div>
                <div className="text-[10px] text-neutral-500">Seed: 1337 | Steps: 500 | Dynamic Half-Spread</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('RegimeAdaptive', 8888, 500)}
                className="w-full text-left p-2 rounded bg-[#131313] hover:bg-[#1a1a1a] border border-[#222222] transition-colors cursor-pointer"
              >
                <div className="font-semibold text-neutral-200 text-[11px]">Multi-Regime Adaptation</div>
                <div className="text-[10px] text-neutral-500">Seed: 8888 | Steps: 500 | Markovian Vol Switching</div>
              </button>
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 pt-2 border-t border-[#1a1a1a]">
            Runs are seeded via standard <code className="text-neutral-400">std::mt19937_64</code> PRNG.
          </div>
        </div>
      </div>

      {/* Latest Result Card */}
      {lastExperiment && (
        <div className="terminal-border p-4 bg-[#0e0e0e] space-y-2 border-emerald-900/40">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-[#222222] gap-2">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="terminal-text text-emerald-400">LATEST SIMULATION SUMMARY</span>
            </div>
            <div className="text-[10px] text-neutral-400 space-x-2">
              <span>Strategy: <strong className="text-white">{lastExperiment.strategy}</strong></span>
              <span>•</span>
              <span>Seed: <strong className="text-amber-400">{lastExperiment.seed}</strong></span>
              <span>•</span>
              <span>Steps: <strong className="text-white">{lastExperiment.duration}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
            <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
              <span className="text-[10px] text-neutral-500 uppercase block">Total P&L</span>
              <span className={`text-base font-bold tabular-nums block mt-0.5 ${lastPnl?.colorClass}`}>
                {lastPnl?.text} <span className="text-[10px] font-normal text-neutral-500">USD</span>
              </span>
            </div>

            <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
              <span className="text-[10px] text-neutral-500 uppercase block">Sortino Ratio</span>
              <span className="text-base font-bold text-purple-400 tabular-nums block mt-0.5">
                {(lastExperiment.results.sortino_ratio ?? 0).toFixed(2)}
              </span>
            </div>

            <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
              <span className="text-[10px] text-neutral-500 uppercase block">Adverse Selection</span>
              <span className={`text-base font-bold tabular-nums block mt-0.5 ${
                (lastExperiment.results.adverse_selection ?? 0) > 0.02 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                ${(lastExperiment.results.adverse_selection ?? 0).toFixed(4)}
              </span>
            </div>

            <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
              <span className="text-[10px] text-neutral-500 uppercase block">Max Drawdown</span>
              <span className="text-base font-bold text-amber-400 tabular-nums block mt-0.5">
                {formatNumber(lastExperiment.results.max_drawdown, 2)}{' '}
                <span className="text-[10px] font-normal text-neutral-500">USD</span>
              </span>
            </div>

            <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
              <span className="text-[10px] text-neutral-500 uppercase block">Inventory Half-Life</span>
              <span className="text-base font-bold text-sky-400 tabular-nums block mt-0.5">
                {(lastExperiment.results.inventory_half_life ?? 0).toFixed(1)} steps
              </span>
            </div>

            <div className="bg-[#121212] p-2.5 rounded border border-[#222222]">
              <span className="text-[10px] text-neutral-500 uppercase block">Trades Executed</span>
              <span className="text-base font-bold text-white tabular-nums block mt-0.5">
                {formatInteger(lastExperiment.results.trades_count)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Comparison & History Section */}
      {experimentsHistory.length > 0 && (
        <div className="terminal-border p-4 bg-[#0e0e0e] space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-[#222222] gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span className="terminal-text">EXPERIMENT HISTORY & BENCHMARKS</span>
              </div>
              
              {/* Tab switcher: Table vs Visual Comparison */}
              <div className="flex items-center bg-[#141414] p-0.5 rounded border border-[#262626]">
                <button
                  type="button"
                  onClick={() => setActiveTab('runs')}
                  className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                    activeTab === 'runs' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  TABLE VIEW
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('compare')}
                  className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                    activeTab === 'compare' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  COMPARATIVE CHART
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">
                {experimentsHistory.length} runs recorded
              </span>
              <button
                type="button"
                onClick={exportToCSV}
                className="text-[10px] text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download CSV
              </button>
            </div>
          </div>

          {activeTab === 'runs' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#222222] text-neutral-500 text-[10px] uppercase">
                    <th className="py-2 px-2">Time</th>
                    <th className="px-2">Strategy</th>
                    <th className="px-2 text-right">Seed</th>
                    <th className="px-2 text-right">Steps</th>
                    <th className="px-2 text-right">Total P&L</th>
                    <th className="px-2 text-right">Sortino</th>
                    <th className="px-2 text-right">Adverse Sel.</th>
                    <th className="px-2 text-right">t½ Half-Life</th>
                    <th className="px-2 text-right">Max DD</th>
                    <th className="px-2 text-right">Trades</th>
                    <th className="px-2 text-right">Volume</th>
                    <th className="px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {experimentsHistory.map((exp) => {
                    const pnl = formatPnL(exp.results.pnl, 2);
                    return (
                      <tr key={exp.id} className="hover:bg-[#141414] transition-colors">
                        <td className="py-2 px-2 text-neutral-500 tabular-nums">{exp.timestamp}</td>
                        <td className="px-2 font-medium text-neutral-200">{exp.strategy}</td>
                        <td className="px-2 text-right font-mono text-amber-400 tabular-nums">{exp.seed}</td>
                        <td className="px-2 text-right text-neutral-400 tabular-nums">{exp.duration}</td>
                        <td className={`px-2 text-right tabular-nums font-semibold ${pnl.colorClass}`}>
                          {pnl.text}
                        </td>
                        <td className="px-2 text-right text-purple-400 tabular-nums font-semibold">
                          {(exp.results.sortino_ratio ?? 0).toFixed(2)}
                        </td>
                        <td className={`px-2 text-right tabular-nums ${(exp.results.adverse_selection ?? 0) > 0.02 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ${(exp.results.adverse_selection ?? 0).toFixed(4)}
                        </td>
                        <td className="px-2 text-right text-sky-400 tabular-nums">
                          {(exp.results.inventory_half_life ?? 0).toFixed(1)}
                        </td>
                        <td className="px-2 text-right text-neutral-300 tabular-nums">
                          {formatNumber(exp.results.max_drawdown, 2)}
                        </td>
                        <td className="px-2 text-right text-neutral-300 tabular-nums">
                          {formatInteger(exp.results.trades_count)}
                        </td>
                        <td className="px-2 text-right text-neutral-300 tabular-nums">
                          {formatInteger(exp.results.volume_traded)}
                        </td>
                        <td className="px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(exp.strategy, exp.seed, exp.duration)}
                            title="Reload parameters into form"
                            className="text-[10px] px-2 py-0.5 rounded bg-[#1e1e1e] hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                          >
                            Load
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Comparative Recharts View */
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="name" stroke="#666" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#666" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0d0d0d', borderColor: '#333', fontSize: '11px' }}
                    itemStyle={{ color: '#eee' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="pnl" name="Total P&L (USD)" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="drawdown" name="Max Drawdown (USD)" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="sortino" name="Sortino Ratio" fill="#a855f7" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
