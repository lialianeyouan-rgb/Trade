import { useState } from 'react';

export default function ResearchLabView({ setHistory }: { setHistory: any }) {
  const [strategy, setStrategy] = useState('FixedSpreadMM');
  const [seed, setSeed] = useState(42);
  const [duration, setDuration] = useState(0);

  const handleRun = () => {
    setHistory([]); // clear previous history chart
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/market`);
    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: 'START_EXPERIMENT',
            strategy,
            seed,
            duration
        }));
    };
  };

  return (
    <div className="terminal-border p-4 font-mono text-sm max-w-2xl">
        <h3 className="terminal-text mb-4">RESEARCH LAB</h3>
        <p className="text-[#a3a3a3] mb-6">Launch specialized market-making strategies with deterministic seeds to reproduce edge cases or stress-test risk models.</p>
        
        <div className="space-y-4 mb-6 border border-[#262626] p-4 bg-[#121212]">
            <div className="flex justify-between items-center">
                <label className="text-[#a3a3a3]">STRATEGY:</label>
                <select className="bg-black border border-[#333] p-1 w-48 text-white focus:outline-none focus:border-green-500" value={strategy} onChange={e => setStrategy(e.target.value)}>
                    <option value="FixedSpreadMM">FixedSpreadMM</option>
                    <option value="InventoryAware">InventoryAwareMM</option>
                    <option value="VolatilityAdaptive">VolatilityAdaptiveMM</option>
                    <option value="RegimeAdaptive">RegimeAdaptiveMM</option>
                </select>
            </div>
            <div className="flex justify-between items-center">
                <label className="text-[#a3a3a3]">RNG SEED:</label>
                <input type="number" className="bg-black border border-[#333] p-1 w-48 text-white focus:outline-none focus:border-green-500" value={seed} onChange={e => setSeed(Number(e.target.value))} />
            </div>
            <div className="flex justify-between items-center">
                <label className="text-[#a3a3a3]">DURATION (Steps):</label>
                <div>
                    <input type="number" className="bg-black border border-[#333] p-1 w-48 text-white focus:outline-none focus:border-green-500" value={duration} onChange={e => setDuration(Number(e.target.value))} />
                    <span className="text-xs text-gray-500 ml-2 absolute">0 = Infinite</span>
                </div>
            </div>
        </div>

        <button onClick={handleRun} className="bg-[#262626] hover:bg-green-900/50 hover:text-green-400 hover:border-green-500 border border-[#333] px-6 py-2 transition-colors">
            RUN EXPERIMENT
        </button>
    </div>
  );
}
