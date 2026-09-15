import { useState } from 'react';
import MarketView from './components/MarketView';
import StrategyView from './components/StrategyView';
import ResearchLabView from './components/ResearchLabView';
import AutopsyView from './components/AutopsyView';
import ExperimentsView from './components/ExperimentsView';

const views = ['MARKET', 'STRATEGY', 'RESEARCH', 'AUTOPSY', 'EXPERIMENTS'];

export default function App() {
  const [activeView, setActiveView] = useState('MARKET');

  const renderView = () => {
    switch(activeView) {
      case 'MARKET': return <MarketView />;
      case 'STRATEGY': return <StrategyView />;
      case 'RESEARCH': return <ResearchLabView />;
      case 'AUTOPSY': return <AutopsyView />;
      case 'EXPERIMENTS': return <ExperimentsView />;
      default: return <MarketView />;
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
        <div className="terminal-text text-green-500">● SIMULATION RUNNING</div>
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
