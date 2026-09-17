import { useState, useEffect, useRef } from 'react';
import MarketView from './components/MarketView';
import ResearchLabView from './components/ResearchLabView';

const views = ['MARKET', 'RESEARCH'];

export default function App() {
  const [activeView, setActiveView] = useState('MARKET');
  
  // Shared State
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/market`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'engine_data') {
          try {
            const parsed = JSON.parse(message.data);
            setData(parsed);
            if (parsed.performance && parsed.market) {
               setHistory(prev => {
                  const newHist = [...prev, {
                      time: parsed.step,
                      pnl: parsed.performance.total_pnl,
                      inventory: parsed.strategy.inventory,
                      mid: parsed.market.mid_price
                  }];
                  return newHist.slice(-100);
               });
            }
          } catch(e) {
            console.error("Failed to parse engine data JSON", message.data, e);
          }
        } else if (message.type === 'engine_log') {
          console.log("Engine log:", message.data);
        }
      } catch(e) {
        console.error("Failed to parse message JSON", event.data, e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected. Reconnecting in 2s...');
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 2000);
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);


  const renderView = () => {
    switch(activeView) {
      case 'MARKET': return <MarketView data={data} history={history} isConnected={isConnected} />;
      case 'RESEARCH': return <ResearchLabView setHistory={setHistory} />;
      default: return <MarketView data={data} history={history} isConnected={isConnected} />;
    }
  }

  return (
    <div className="h-screen flex flex-col p-4 bg-[#0a0a0a]">
      <header className="flex justify-between items-center mb-4 border-b border-[#262626] pb-2">
        <h1 className="text-xl font-bold tracking-tighter">ADAPTIVE MARKET-MAKING ENGINE</h1>
        <div className="flex gap-4">
          {views.map(view => (
            <button 
              key={view} 
              onClick={() => setActiveView(view)}
              className={`px-3 py-1 text-sm ${activeView === view ? 'bg-[#262626] text-white' : 'text-[#737373] hover:text-white'}`}
            >
              {view}
            </button>
          ))}
        </div>
        <div className={`terminal-text ${isConnected ? "text-green-500" : "text-red-500"}`}>
            {isConnected ? "● SIMULATION RUNNING" : "● DISCONNECTED"}
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <div className="h-full border border-[#262626] p-4">
          <h2 className="text-lg mb-4">{activeView} VIEW</h2>
          {renderView()}
        </div>
      </main>
    </div>
  );
}
