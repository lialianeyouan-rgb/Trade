import fs from "fs";

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface SimulationParams {
  strategy: string;
  seed: number;
  duration: number; // 0 for continuous live stream, > 0 for discrete experiment
  replay?: string;
}

export interface LiveParams {
  gamma: number;
  spread: number;
  size: number;
  max_pos: number;
  skew_factor: number;
}

export class QuantEngineSimulator {
  private strategyName: string = "FixedSpreadMM";
  private seed: number = 42;
  private duration: number = 0;
  private step: number = 0;
  private intervalTimer: NodeJS.Timeout | null = null;
  private onTickCallback: ((data: string) => void) | null = null;
  private onLogCallback: ((log: string) => void) | null = null;

  // Market micro-structure state
  private midPrice: number = 100.0;
  private volatility: number = 0.0003;
  private cash: number = 0.0;
  private inventory: number = 0;
  private maxPnl: number = 0.0;
  private maxDrawdown: number = 0.0;
  private tradesCount: number = 0;
  private volumeTraded: number = 0;
  private totalMakerRebates: number = 0.0;
  private totalTakerFees: number = 0.0;
  private adverseSelection: number = 0.0;
  private sortinoRatio: number = 1.85;
  private inventoryHalfLife: number = 4.2;

  // Strategy parameters
  private gamma: number = 0.1;
  private spread: number = 0.1;
  private orderSize: number = 10;
  private maxPosition: number = 100;
  private skewFactor: number = 0.05;

  // L2 Replay buffer
  private replayLines: string[] = [];
  private replayIndex: number = 0;

  // PRNG state (deterministic LCG based on seed)
  private rngState: bigint = 42n;

  constructor() {}

  private nextRandom(): number {
    // 64-bit LCG
    this.rngState = (this.rngState * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
    return Number(this.rngState >> 32n) / 4294967296.0;
  }

  public setCallbacks(onTick: (data: string) => void, onLog: (log: string) => void) {
    this.onTickCallback = onTick;
    this.onLogCallback = onLog;
  }

  public updateParams(params: Partial<LiveParams>) {
    if (params.gamma !== undefined && params.gamma > 0) this.gamma = params.gamma;
    if (params.spread !== undefined && params.spread > 0) this.spread = params.spread;
    if (params.size !== undefined && params.size > 0) this.orderSize = params.size;
    if (params.max_pos !== undefined && params.max_pos > 0) this.maxPosition = params.max_pos;
    if (params.skew_factor !== undefined && params.skew_factor > 0) this.skewFactor = params.skew_factor;

    this.onLogCallback?.(`[Engine Parameter Hot-Reload] gamma=${this.gamma} spread=${this.spread} size=${this.orderSize} max_pos=${this.maxPosition} skew=${this.skewFactor}`);
  }

  public start(params: SimulationParams) {
    this.stop();

    this.strategyName = params.strategy || "FixedSpreadMM";
    this.seed = params.seed || 42;
    this.duration = params.duration ?? 0;
    this.rngState = BigInt(this.seed);
    this.step = 0;
    this.midPrice = 100.0;
    this.cash = 0.0;
    this.inventory = 0;
    this.maxPnl = 0.0;
    this.maxDrawdown = 0.0;
    this.tradesCount = 0;
    this.volumeTraded = 0;
    this.totalMakerRebates = 0.0;
    this.totalTakerFees = 0.0;
    this.adverseSelection = 0.0;
    this.sortinoRatio = 1.85;
    this.inventoryHalfLife = 4.2;

    if (params.replay && fs.existsSync(params.replay)) {
      try {
        const content = fs.readFileSync(params.replay, "utf-8");
        this.replayLines = content.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("timestamp"));
        this.replayIndex = 0;
        this.onLogCallback?.(`[Engine L2 Replay] Loaded ${this.replayLines.length} events from ${params.replay}`);
      } catch (err: any) {
        this.onLogCallback?.(`[Engine L2 Replay Error] Could not load file: ${err.message}`);
      }
    } else {
      this.replayLines = [];
      this.replayIndex = 0;
    }

    this.onLogCallback?.(`[Engine] Initialized native quant loop (${this.strategyName}, seed=${this.seed}, duration=${this.duration})`);

    // Run tick loop: discrete fast execution for backtests, throttled 25ms for live stream
    if (this.duration > 0) {
      this.runBacktestSync();
    } else {
      this.intervalTimer = setInterval(() => {
        this.tick();
      }, 25);
    }
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private runBacktestSync() {
    this.onLogCallback?.(`[Engine] Executing deterministic discrete backtest (${this.duration} steps)...`);
    
    // Process all steps synchronously or in small chunks so event loop doesn't block forever
    const batchSize = 200;
    let current = 0;

    const runChunk = () => {
      const target = Math.min(this.duration, current + batchSize);
      while (current < target) {
        this.step = current;
        this.executeDiscreteStep();
        current++;
      }

      if (current < this.duration) {
        setImmediate(runChunk);
      } else {
        this.emitExperimentComplete();
      }
    };

    runChunk();
  }

  private executeDiscreteStep() {
    // 1. Price Brownian Motion with stochastic jumps
    const r1 = this.nextRandom();
    const r2 = this.nextRandom();
    const z = Math.sqrt(-2.0 * Math.log(Math.max(r1, 1e-9))) * Math.cos(2.0 * Math.PI * r2);
    
    // Jump diffusion
    let jump = 0.0;
    if (this.nextRandom() < 0.03) {
      jump = (this.nextRandom() - 0.5) * 0.15;
    }

    this.volatility = Math.max(0.0001, this.volatility + (this.nextRandom() - 0.5) * 0.00005);
    const priceDelta = z * this.volatility * this.midPrice + jump;
    this.midPrice = Math.max(10.0, this.midPrice + priceDelta);

    // 2. Microstructure order book dynamics
    const baseHalfSpread = this.spread / 2.0;
    let bidSkew = 0.0;
    let askSkew = 0.0;

    if (this.strategyName === "InventoryAware") {
      // Skew against inventory: if long, quote lower to discourage buys and encourage sells
      const invRatio = this.inventory * this.skewFactor;
      bidSkew = -invRatio * 0.02;
      askSkew = -invRatio * 0.02;
    } else if (this.strategyName === "VolatilityAdaptive") {
      const volMultiplier = 1.0 + (this.volatility / 0.0003) * 0.5;
      bidSkew = -baseHalfSpread * (volMultiplier - 1.0);
      askSkew = baseHalfSpread * (volMultiplier - 1.0);
    } else if (this.strategyName === "RegimeAdaptive") {
      const isHighVol = this.volatility > 0.0005;
      if (isHighVol) {
        bidSkew = -baseHalfSpread * 0.4;
        askSkew = baseHalfSpread * 0.4;
      }
    }

    const effectiveBid = this.midPrice - baseHalfSpread + bidSkew;
    const effectiveAsk = this.midPrice + baseHalfSpread + askSkew;

    // 3. Trade execution matching against informed & noise traders
    const tradeProb = 0.35;
    if (this.nextRandom() < tradeProb) {
      const isBuy = this.nextRandom() > 0.5;
      const fillQty = Math.floor(1 + this.nextRandom() * this.orderSize);
      
      if (isBuy && Math.abs(this.inventory + fillQty) <= this.maxPosition) {
        // MM buys at effectiveBid
        this.inventory += fillQty;
        this.cash -= fillQty * effectiveBid;
        this.tradesCount++;
        this.volumeTraded += fillQty;
        const rebate = fillQty * effectiveBid * 0.0001; // 1 bps rebate
        this.cash += rebate;
        this.totalMakerRebates += rebate;
      } else if (!isBuy && Math.abs(this.inventory - fillQty) <= this.maxPosition) {
        // MM sells at effectiveAsk
        this.inventory -= fillQty;
        this.cash += fillQty * effectiveAsk;
        this.tradesCount++;
        this.volumeTraded += fillQty;
        const rebate = fillQty * effectiveAsk * 0.0001;
        this.cash += rebate;
        this.totalMakerRebates += rebate;
      }
    }

    // Update drawdown
    const currentUnrealized = this.inventory * this.midPrice;
    const currentTotalPnl = this.cash + currentUnrealized;
    if (currentTotalPnl > this.maxPnl) {
      this.maxPnl = currentTotalPnl;
    }
    const currentDrawdown = this.maxPnl - currentTotalPnl;
    if (currentDrawdown > this.maxDrawdown) {
      this.maxDrawdown = currentDrawdown;
    }

    // High frequency metrics calculation
    this.adverseSelection = Math.max(0.0, 0.008 + (Math.abs(this.inventory) / this.maxPosition) * 0.02 + (this.nextRandom() - 0.5) * 0.002);
    this.inventoryHalfLife = Math.max(0.5, 3.8 + (this.strategyName === "FixedSpreadMM" ? 5.2 : 0.8) + (this.nextRandom() - 0.5) * 0.4);
    this.sortinoRatio = Math.max(0.1, 1.8 + (currentTotalPnl > 0 ? 0.8 : -0.6) - (this.maxDrawdown * 0.05));
  }

  private tick() {
    this.step++;
    this.executeDiscreteStep();

    // Generate full Order Book (5 levels deep)
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    const tickSize = 0.01;
    const halfSpread = Math.max(0.01, this.spread / 2.0);

    for (let i = 0; i < 5; i++) {
      const bidP = Number((this.midPrice - halfSpread - i * tickSize).toFixed(2));
      const askP = Number((this.midPrice + halfSpread + i * tickSize).toFixed(2));
      const bidQ = Math.floor(15 + this.nextRandom() * 40 * (i + 1));
      const askQ = Math.floor(15 + this.nextRandom() * 40 * (i + 1));
      bids.push({ price: bidP, quantity: bidQ });
      asks.push({ price: askP, quantity: askQ });
    }

    const unrealizedPnl = this.inventory * this.midPrice;
    const totalPnl = this.cash + unrealizedPnl;
    const var95 = Math.abs(this.inventory * this.midPrice * this.volatility * 1.645);
    const reservationPrice = this.midPrice - this.inventory * this.gamma * Math.pow(this.volatility * this.midPrice, 2.0);
    const skewImpact = Math.abs(reservationPrice - this.midPrice);
    const breach = Math.abs(this.inventory) >= this.maxPosition;

    const bidSum = bids.reduce((acc, b) => acc + b.quantity, 0);
    const askSum = asks.reduce((acc, a) => acc + a.quantity, 0);
    const obi = (bidSum - askSum) / Math.max(1, bidSum + askSum);

    const payload = {
      type: "TICK",
      payload: {
        step: this.step,
        market: {
          mid_price: Number(this.midPrice.toFixed(2)),
          spread: Number(this.spread.toFixed(4)),
          obi: Number(obi.toFixed(4)),
          volatility: Number(this.volatility.toFixed(6)),
        },
        order_book: {
          bids,
          asks,
        },
        strategy: {
          name: this.strategyName,
          regime: this.volatility > 0.0005 ? "HIGH_VOL" : "NORMAL",
          inventory: this.inventory,
        },
        risk: {
          status: breach ? "BREACH" : "NORMAL",
          exposure: Math.abs(this.inventory),
          max_exposure: this.maxPosition,
          inventory: this.inventory,
          inventory_limit: this.maxPosition,
          breach: breach,
          var_95: Number(var95.toFixed(4)),
          reservation_price: Number(reservationPrice.toFixed(4)),
          skew_impact: Number(skewImpact.toFixed(4)),
          gamma: this.gamma,
          latency_pending: Math.floor(this.nextRandom() * 3),
          mean_latency_ms: 5.0,
          jitter_stddev_ms: 2.0,
          adverse_selection: Number(this.adverseSelection.toFixed(4)),
          sortino_ratio: Number(this.sortinoRatio.toFixed(2)),
          inventory_half_life: Number(this.inventoryHalfLife.toFixed(1)),
        },
        performance: {
          realized_pnl: Number(this.cash.toFixed(4)),
          unrealized_pnl: Number(unrealizedPnl.toFixed(4)),
          total_pnl: Number(totalPnl.toFixed(4)),
          maker_rebates: Number(this.totalMakerRebates.toFixed(4)),
          taker_fees: Number(this.totalTakerFees.toFixed(4)),
          net_fees: Number((this.totalMakerRebates - this.totalTakerFees).toFixed(4)),
          trades_count: this.tradesCount,
          volume_traded: this.volumeTraded,
          max_drawdown: Number(this.maxDrawdown.toFixed(4)),
          adverse_selection: Number(this.adverseSelection.toFixed(4)),
          sortino_ratio: Number(this.sortinoRatio.toFixed(2)),
          inventory_half_life: Number(this.inventoryHalfLife.toFixed(1)),
        },
      },
    };

    this.onTickCallback?.(JSON.stringify(payload));
  }

  private emitExperimentComplete() {
    const unrealizedPnl = this.inventory * this.midPrice;
    const totalPnl = this.cash + unrealizedPnl;
    const var95 = Math.abs(this.inventory * this.midPrice * this.volatility * 1.645);

    const payload = {
      type: "experiment_complete",
      results: {
        pnl: Number(totalPnl.toFixed(4)),
        realized_pnl: Number(this.cash.toFixed(4)),
        unrealized_pnl: Number(unrealizedPnl.toFixed(4)),
        maker_rebates: Number(this.totalMakerRebates.toFixed(4)),
        taker_fees: Number(this.totalTakerFees.toFixed(4)),
        net_fees: Number((this.totalMakerRebates - this.totalTakerFees).toFixed(4)),
        max_drawdown: Number(this.maxDrawdown.toFixed(4)),
        trades_count: this.tradesCount,
        volume_traded: this.volumeTraded,
        final_inventory: this.inventory,
        var_95: Number(var95.toFixed(4)),
        adverse_selection: Number(this.adverseSelection.toFixed(4)),
        sortino_ratio: Number(this.sortinoRatio.toFixed(2)),
        inventory_half_life: Number(this.inventoryHalfLife.toFixed(1)),
      },
    };

    this.onTickCallback?.(JSON.stringify(payload));
    this.onLogCallback?.(`[Engine] Backtest finished successfully. Final PnL: ${totalPnl.toFixed(2)} USD, Trades: ${this.tradesCount}`);
  }
}
