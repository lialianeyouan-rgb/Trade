export default function MarketView() {
  return (
    <div className="grid grid-cols-3 gap-4 h-full font-mono text-xs">
      <div className="terminal-border p-4">
        <h3 className="terminal-text mb-2">MARKET</h3>
        <div className="space-y-1">
          <div>SYMBOL: BTC/USD</div>
          <div>MID: 101.02</div>
          <div>SPREAD: 0.03</div>
          <div>VOL: 2.81%</div>
        </div>
      </div>
      <div className="terminal-border p-4">
        <h3 className="terminal-text mb-2">ORDER BOOK</h3>
        <div className="space-y-0.5">
          <div className="text-red-400">ASK 101.05 ███ 240</div>
          <div className="text-red-400">ASK 101.04 █████ 410</div>
          <div className="text-red-400">ASK 101.03 ██ 120</div>
          <div className="my-2 border-t border-[#262626]"></div>
          <div className="text-green-400">BID 101.02 ████ 350</div>
          <div className="text-green-400">BID 101.01 █████ 510</div>
        </div>
      </div>
      <div className="terminal-border p-4">
        <h3 className="terminal-text mb-2">STRATEGY</h3>
        <div className="space-y-1">
          <div>REGIME: HIGH VOL</div>
          <div>CONFIDENCE: 87%</div>
          <div className="my-2 border-t border-[#262626]"></div>
          <div>SPREAD: 4.7 BPS</div>
          <div>BID SIZE: 35</div>
          <div>ASK SIZE: 20</div>
          <div>INVENTORY: +85</div>
        </div>
      </div>
      <div className="col-span-3 terminal-border p-4 h-48">
          <h3 className="terminal-text mb-2">LIVE P&L</h3>
          <div className="h-32 bg-[#171717] flex items-end">
              <div className="w-full h-24 bg-green-900/20 border-t border-green-500"></div>
          </div>
      </div>
    </div>
  );
}
