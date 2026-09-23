import { useState, useEffect, useRef } from 'react';
import MarketView from './components/MarketView';
import ResearchLabView from './components/ResearchLabView';
import AutopsyView from './components/AutopsyView';
import StrategyView from './components/StrategyView';
import { EngineData, ExperimentResults } from './types';
import { Activity, FlaskConical, ShieldAlert, Cpu, RefreshCw } from 'lucide-react';

const views = [
  { id: 'MARKET', label: 'MARKET VIEW', icon: Activity },
  { id: 'RESEARCH', label: 'RESEARCH LAB', icon: FlaskConical },
  { id: 'AUTOPSY', label: 'RISK & AUTOPSY', icon: ShieldAlert },
  { id: 'STRATEGY', label: 'STRATEGY PARAMS', icon: Cpu },
];

export default function App() {
  const [activeView, setActiveView] = useState('MARKET');
  
  // Shared Engine & Market State
  const [data, setData] = useState<EngineData | null>(null);
  const [history, setHistory] = useState<Array<{ time: number; pnl: number; inventory: number; mid: number }>>([]);
  const [lastExperiment, setLastExperiment] = useState<{
    strategy: string;
    seed: number;
    duration: number;
    results: ExperimentResults;
  } | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentExperimentRef = useRef<{ strategy: string; seed: number; duration: number }>({
    strategy: 'FixedSpreadMM',
    seed: 42,
    duration: 0,
  });

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/market`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[WS] Connected to quant engine stream');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'engine_data') {
          try {
            let parsed = JSON.parse(message.data);
            // Handle standardized IPC protocol {"type": "TICK", "payload": {...}}
            if (parsed.type === 'TICK' && parsed.payload) {
              parsed = parsed.payload;
            }
            if (parsed.type === 'experiment_complete' && parsed.results) {
              setIsSimulating(false);
              if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
              setLastExperiment({
                strategy: currentExperimentRef.current.strategy,
                seed: currentExperimentRef.current.seed,
                duration: currentExperimentRef.current.duration,
                results: parsed.results,
              });
              setData(parsed);
            } else {
              setData(parsed);
              if (parsed.performance && parsed.market) {
                setHistory((prev) => {
                  const newHist = [
                    ...prev,
                    {
                      time: parsed.step,
                      pnl: parsed.performance.total_pnl,
                      inventory: parsed.strategy.inventory,
                      mid: parsed.market.mid_price,
                    },
                  ];
                  return newHist.slice(-100);
                });
              }
            }
          } catch (e) {
            console.error('[WS] Failed to parse engine_data JSON', message.data, e);
          }
        } else if (message.type === 'engine_log') {
          console.log('[Engine Log]', message.data);
          if (message.data?.includes('Simulation process finished') || message.data?.includes('Engine error')) {
            setIsSimulating(false);
          }
        }
      } catch (e) {
        console.error('[WS] Failed to parse message JSON', event.data, e);
      }
    };

    ws.onerror = (error) => {
      // Suppress noisy event logging for standard socket disconnects during HMR / proxy reboot
      setIsConnected(false);
      setIsSimulating(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsSimulating(false);
      console.log('[WS] Disconnected. Reconnecting in 2s...');
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 2000);
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleStartExperiment = (params: { strategy: string; seed: number; duration: number; replay?: string }) => {
    currentExperimentRef.current = params;
    setHistory([]);
    if (params.duration > 0) {
      setIsSimulating(true);
      // Failsafe timeout in case simulation runs unexpectedly long
      if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
      simulationTimeoutRef.current = setTimeout(() => {
        setIsSimulating(false);
      }, 15000);
    } else {
      setIsSimulating(false);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'START_EXPERIMENT',
          ...params,
        })
      );
    } else {
      console.warn('[WS] WebSocket not open, cannot send START_EXPERIMENT');
      setIsSimulating(false);
    }
  };

  const handleUpdateParams = (params: { gamma?: number; spread?: number; size?: number; max_pos?: number; skew_factor?: number }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'UPDATE_PARAMS',
          ...params,
        })
      );
    }
  };

  return (
    <div className="h-screen w-screen bg-[#080808] text-[#e0e0e0] font-mono flex flex-col overflow-hidden select-none">
      {/* Header Bar */}
      <header className="h-14 border-b border-[#222222] bg-[#0c0c0c] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
            <span className="font-bold tracking-wider text-sm text-white flex items-center gap-2">
              ADAPTIVE MARKET-MAKING ENGINE
              <span className="hidden sm:inline-block text-[10px] font-normal px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                QUANT TERMINAL v1.0
              </span>
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-[#141414] p-1 rounded border border-[#222222]">
          {views.map((v) => {
            const Icon = v.icon;
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-all cursor-pointer ${
                  isActive
                    ? 'bg-neutral-800 text-white font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#1c1c1c]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-neutral-500'}`} />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Engine Status Badge in Top-Right */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isSimulating ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/40 border border-amber-900/60 text-amber-400 text-xs font-semibold">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                <span>RUNNING SIMULATION...</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                <span>ENGINE ONLINE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/40 border border-rose-900/60 text-rose-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span>DISCONNECTED</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace with Independent Scrollable Views */}
      <main className="flex-1 overflow-hidden p-3 min-h-0 relative">
        <div className={`absolute inset-3 overflow-hidden ${activeView === 'MARKET' ? 'block' : 'hidden'}`}>
          <MarketView data={data} history={history} isConnected={isConnected} />
        </div>
        <div className={`absolute inset-3 overflow-hidden ${activeView === 'RESEARCH' ? 'block' : 'hidden'}`}>
          <ResearchLabView
            onStartExperiment={handleStartExperiment}
            lastExperiment={lastExperiment}
            isConnected={isConnected}
            isSimulating={isSimulating}
            setHistory={setHistory}
          />
        </div>
        <div className={`absolute inset-3 overflow-hidden ${activeView === 'AUTOPSY' ? 'block' : 'hidden'}`}>
          <AutopsyView data={data} history={history} isConnected={isConnected} />
        </div>
        <div className={`absolute inset-3 overflow-hidden ${activeView === 'STRATEGY' ? 'block' : 'hidden'}`}>
          <StrategyView data={data} isConnected={isConnected} onUpdateParams={handleUpdateParams} />
        </div>
      </main>
    </div>
  );
}
