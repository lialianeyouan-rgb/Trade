export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface MarketMetrics {
  mid_price: number;
  spread: number;
  obi: number;
  volatility: number;
}

export interface StrategyMetrics {
  name: string;
  regime: string;
  inventory: number;
}

export interface RiskMetrics {
  status: 'NORMAL' | 'BREACH' | 'KILLED';
  exposure: number;
  max_exposure: number;
  inventory: number;
  inventory_limit: number;
  breach: boolean;
  var_95: number;
  reservation_price: number;
  skew_impact: number;
  gamma: number;
  latency_pending: number;
  latency_source?: 'observed' | 'estimated';
  mean_latency_ms: number;
  jitter_stddev_ms: number;
  latency_samples?: number;
  requested_latency_mean_ms?: number;
  observed_latency_mean_ms?: number;
  queue_wait_mean_ms?: number;
  observed_latency_p50_ms?: number;
  observed_latency_p95_ms?: number;
  observed_latency_p99_ms?: number;
  observed_latency_min_ms?: number;
  observed_latency_max_ms?: number;
  latency_max_pending?: number;
  adverse_selection?: number;
  sortino_ratio?: number;
  inventory_half_life?: number;
}

export interface PerformanceMetrics {
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  maker_rebates: number;
  taker_fees: number;
  net_fees: number;
  trades_count: number;
  volume_traded: number;
  max_drawdown: number;
  adverse_selection?: number;
  sortino_ratio?: number;
  inventory_half_life?: number;
  latency_samples?: number;
  requested_latency_mean_ms?: number;
  observed_latency_mean_ms?: number;
  queue_wait_mean_ms?: number;
  observed_latency_p50_ms?: number;
  observed_latency_p95_ms?: number;
  observed_latency_p99_ms?: number;
  observed_latency_min_ms?: number;
  observed_latency_max_ms?: number;
  latency_max_pending?: number;
}

export interface EngineData {
  step: number;
  engine_mode?: string;
  market: MarketMetrics;
  order_book: OrderBookData;
  strategy: StrategyMetrics;
  risk: RiskMetrics;
  performance: PerformanceMetrics;
}

export interface ExperimentResults {
  pnl: number;
  engine_mode?: string;
  strategy?: string;
  seed?: number;
  duration?: number;
  realized_pnl?: number;
  unrealized_pnl?: number;
  maker_rebates?: number;
  taker_fees?: number;
  net_fees?: number;
  max_drawdown: number;
  trades_count: number;
  volume_traded: number;
  latency_source?: 'observed' | 'estimated';
  final_inventory?: number;
  var_95?: number;
  adverse_selection?: number;
  sortino_ratio?: number;
  inventory_half_life?: number;
  latency_samples?: number;
  requested_latency_mean_ms?: number;
  observed_latency_mean_ms?: number;
  queue_wait_mean_ms?: number;
  observed_latency_p50_ms?: number;
  observed_latency_p95_ms?: number;
  observed_latency_p99_ms?: number;
  observed_latency_min_ms?: number;
  observed_latency_max_ms?: number;
  latency_max_pending?: number;
}

export interface ExperimentRun {
  id: string;
  strategy: string;
  seed: number;
  duration: number;
  results: ExperimentResults;
  timestamp: string;
  timeSeries?: Array<{
    step: number;
    pnl: number;
    inventory: number;
    mid: number;
  }>;
}
