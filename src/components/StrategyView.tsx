export default function StrategyView() {
  return (
    <div className="terminal-border p-4">
        <h3 className="terminal-text mb-4">STRATEGY PERFORMANCE</h3>
        <div className="grid grid-cols-2 gap-4">
            <div>P&L: +$12,421</div>
            <div>SHARPE: 2.41</div>
            <div>DRAWDOWN: 4.8%</div>
            <div>FILL RATE: 31.2%</div>
        </div>
    </div>
  );
}
