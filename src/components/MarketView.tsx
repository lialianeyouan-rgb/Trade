import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface MarketViewProps {
  data: any;
  history: any[];
  isConnected: boolean;
}

export default function MarketView({ data, history, isConnected }: MarketViewProps) {
  return (
    <div className="grid grid-cols-3 gap-4 h-full font-mono text-xs">
      <div className="terminal-border p-4 flex flex-col justify-between">
        <div>
          <h3 className="terminal-text mb-2">MARKET</h3>
          <div className="space-y-1">
            <div>SYMBOL: BTC/USD</div>
            <div>MID: {data?.market?.mid_price !== undefined ? Number(data.market.mid_price).toFixed(2) : '---'}</div>
            <div>SPREAD: {data?.market?.spread !== undefined ? Number(data.market.spread).toFixed(4) : '---'}</div>
            <div>VOL: {data?.market?.volatility !== undefined ? (Number(data.market.volatility) * 100).toFixed(2) : '---'}%</div>
          </div>
        </div>
        <div className="mt-4">
            <span className={isConnected ? "text-green-500" : "text-red-500"}>
                {isConnected ? "● STREAM ACTIVE" : "● OFFLINE"}
            </span>
        </div>
      </div>
      <div className="terminal-border p-4">
        <h3 className="terminal-text mb-2">ORDER BOOK (Top 5)</h3>
        <div className="space-y-0.5">
          {data?.order_book?.asks ? data.order_book.asks.slice().reverse().map((ask: any, i: number) => (
            <div key={`ask-${i}`} className="text-red-400">
              ASK {ask.price.toFixed(2)} ██ {ask.quantity}
            </div>
          )) : <div className="text-red-400">ASK ---</div>}
          
          <div className="my-2 border-t border-[#262626]"></div>
          
          {data?.order_book?.bids ? data.order_book.bids.map((bid: any, i: number) => (
            <div key={`bid-${i}`} className="text-green-400">
              BID {bid.price.toFixed(2)} ██ {bid.quantity}
            </div>
          )) : <div className="text-green-400">BID ---</div>}
        </div>
      </div>
      <div className="terminal-border p-4">
        <h3 className="terminal-text mb-2">STRATEGY & RISK</h3>
        <div className="space-y-1">
          <div>NAME: {data?.strategy?.name || '---'}</div>
          <div>REGIME: {data?.strategy?.regime || '---'}</div>
          <div className="my-2 border-t border-[#262626]"></div>
          <div>INVENTORY: {data?.strategy?.inventory !== undefined ? data.strategy.inventory : '---'}</div>
          <div>RISK EXP: {data?.risk?.exposure !== undefined ? data.risk.exposure : '---'} / {data?.risk?.max_exposure || '---'}</div>
          <div>TRADES: {data?.performance?.trades_count || '0'}</div>
          <div>VOLUME: {data?.performance?.volume_traded || '0'}</div>
        </div>
      </div>
      <div className="col-span-3 terminal-border p-4 h-64 flex flex-col">
          <h3 className="terminal-text mb-2">LIVE METRICS: P&L {data?.performance?.total_pnl !== undefined ? data.performance.total_pnl.toFixed(2) : '---'}</h3>
          <div className="flex-1 bg-[#171717] mt-2 relative">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="time" stroke="#666" tick={{fill: '#666', fontSize: 10}} />
                    <YAxis yAxisId="left" stroke="#22c55e" tick={{fill: '#22c55e', fontSize: 10}} domain={['auto', 'auto']} />
                    <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" tick={{fill: '#3b82f6', fontSize: 10}} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #333'}} />
                    <Line yAxisId="left" type="stepAfter" dataKey="pnl" name="PnL" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line yAxisId="right" type="stepAfter" dataKey="inventory" name="Inventory" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
             </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
}
