# Adaptive Market-Making Research & Simulation Terminal

[![C++20](https://img.shields.io/badge/C%2B%2B-20-00599C?style=flat&logo=c%2B%2B)](https://en.cppreference.com/w/cpp/20)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue)](#installation--quick-start)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **High-performance quantitative research and simulation platform for studying, evaluating, and stress-testing adaptive market-making strategies in market microstructure.**

---

## Table of Contents
1. [Overview & Quantitative Vision](#overview--quantitative-vision)
2. [System Architecture](#system-architecture)
3. [Implemented Market-Making Strategies](#implemented-market-making-strategies)
4. [Risk Engine & Accounting Model](#risk-engine--accounting-model)
5. [Terminal Features](#terminal-features)
6. [Installation & Quick Start](#installation--quick-start)
7. [Reproducibility & Research Lab (Determinism)](#reproducibility--research-lab-determinism)
8. [Model Assumptions & Limitations (Quantitative Disclaimer)](#model-assumptions--limitations-quantitative-disclaimer)
9. [Technical Challenges & Engineering Solutions](#technical-challenges--engineering-solutions)
10. [Roadmap & Future Evolution](#roadmap--future-evolution)

---

## Overview & Quantitative Vision

In modern electronic markets, market makers are exposed to two major risks:
1. **Adverse Selection Risk:** Executing against informed traders right before a price jump or drift.
2. **Inventory Risk:** Accumulating an undesired directional net position during prolonged order imbalances.

This project provides a comprehensive quantitative laboratory environment simulating a high-frequency Limit Order Book (L2). It enables researchers to study the dynamic response of various quoting strategies under stochastic order flow, observing in real time the impact on the order book, net exposure, mark-to-market P&L, and drawdown.

```
                    QUANTITATIVE SIMULATION LOOP
 ┌────────────────────────────────────────────────────────────────────────┐
 │                                                                        │
 │  Stochastic Flow          Limit Order Book        Adaptive Strategies  │
 │  (Noise / Informed) ──► (L2 Matching Engine) ──► (Skew & Spread)       │
 │                               ▲                         │              │
 │                               │                         ▼              │
 │                          P&L Accounting            Risk Engine         │
 │                        (MtM, Realized, DD)  ◄── (Position & Exposure)  │
 │                                                                        │
 └────────────────────────────────────────────────────────────────────────┘
```

> **Positioning Note:** This project serves as a **research terminal and technical demonstration** (quantitative portfolio). It is not designed to be deployed directly on live exchange production feeds without adaptation to specific hardware constraints (DMA, FPGA, kernel-bypass).

---

## System Architecture

The system relies on a strict three-tier decoupling: native compute performance, multi-platform IPC/WebSocket bridge, and real-time visualization interface.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            C++20 CORE ENGINE                                │
│  - Structured L2 Limit Order Book (LOB) (std::map + FIFO buckets)           │
│  - Matching Engine (Limit / Market orders, cancellations)                   │
│  - Deterministic PRNG (std::mt19937_64) for flow generation                 │
│  - 4 Adaptive Quoting Algorithms                                            │
│  - Feature Engine: Mid-price, Spread, OBI (Order Book Imbalance), Micro-Vol │
│  - Risk Engine: Position Tracking, Exposure Limits & Kill-Switch            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ STDOUT JSON (Line-buffered IPC)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NODE.JS BRIDGING SERVER                            │
│  - Multi-platform Process Supervisor (Windows .exe / Unix binary)           │
│  - Lifecycle management of child processes and system signals               │
│  - High-frequency WebSocket server (transmission latency < 20ms)            │
│  - Bidirectional routing of orders and experiment parameters                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ WebSocket (ws://)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REACT 19 QUANT TERMINAL                            │
│  - Market View: Real-time order book with depth gauges                      │
│  - Live Charts: Dual-axis Recharts time series (P&L & Inventory)            │
│  - Research Lab: Deterministic backtesting with comparative table           │
│  - Tabular figures (tabular-nums) and strict monospace typography           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implemented Market-Making Strategies

The engine integrates 4 quoting models with distinct mathematical properties:

### 1. `FixedSpreadMM` (Baseline)
- **Principle:** Benchmark strategy placing symmetric limit buy and sell orders around the mid-price:
  $$P_{bid} = P_{mid} - \frac{\delta}{2}, \quad P_{ask} = P_{mid} + \frac{\delta}{2}$$
- **Property:** Ideal in stationary markets with low volatility, but vulnerable to directional drift and toxic inventory accumulation.

### 2. `InventoryAwareMM` (Inventory Control)
- **Principle:** Inspired by the Avellaneda-Stoikov model, it applies an asymmetric skew to the reservation price based on the current position $q$:
  $$P_{skewed} = P_{mid} - (\gamma \cdot q)$$
  $$P_{bid} = P_{skewed} - \frac{\delta}{2}, \quad P_{ask} = P_{skewed} + \frac{\delta}{2}$$
- **Objective:** When long ($q > 0$), it lowers its quotes to favor selling and discourage buying, dynamically driving inventory back towards 0.

### 3. `VolatilityAdaptiveMM` (Volatility Protection)
- **Principle:** Continuously adjusts half-spread and order size based on realized volatility over the last 50 ticks ($\sigma_t$):
  $$\delta_t = \delta_0 \cdot (1 + 10 \cdot \sigma_t), \quad Q_t = \max\left(1, \left\lfloor \frac{Q_0}{1 + 5 \cdot \sigma_t} \right\rfloor\right)$$
- **Objective:** Widens quotes during turbulent regimes to compensate for liquidity risk and reduces exposed size.

### 4. `RegimeAdaptiveMM` (Regime Switching)
- **Principle:** Microstructural state machine detecting regime transitions according to a critical volatility threshold:
  $$\text{Regime} = \begin{cases} \text{HIGH\_VOL (VolatilityAdaptiveMM)}, & \text{if } \sigma_t > \theta \\ \text{CALM (FixedSpreadMM)}, & \text{otherwise} \end{cases}$$
- **Objective:** Maximizes spread capture rate in calm regimes while automatically activating the protective shield upon turbulence onset.

---

## Risk Engine & Accounting Model

### Risk Management (Risk Engine)
- **Maximum Exposure Control:** Every order proposed by the strategy is subject to a pre-trade allocation test (`is_order_allowed`):
  $$|q_{\text{current}} + \Delta q_{\text{order}}| \le Q_{\max}$$
- **Kill-Switch:** Immediate quote locking if a statutory limit or anomaly is detected.

### Real-Time P&L Accounting
- **Realized P&L:** Net cash flow from executed buy/sell trades:
  $$\text{Cash}_t = \sum_{\text{sales}} (P \times Q) - \sum_{\text{purchases}} (P \times Q)$$
- **Unrealized P&L (Mark-to-Market):** Valuation of residual position at the prevailing mid-price:
  $$\text{Unrealized}_t = q_t \times P_{mid, t}$$
- **Total P&L & Max Drawdown:**
  $$\text{Total P\&L}_t = \text{Cash}_t + \text{Unrealized}_t$$
  $$\text{Drawdown}_t = \max_{s \le t}(\text{Total P\&L}_s) - \text{Total P\&L}_t$$

---

## Terminal Features

- **L2 Order Book Visualization with Depth Gauges:**
  - Displays top 5 Bids and Asks with proportional horizontal volume bars.
  - Real-time **Order Book Imbalance (OBI)** calculation:
    $$OBI = \frac{V_{bid} - V_{ask}}{V_{bid} + V_{ask}} \in [-1, 1]$$
- **High-Frequency Streaming:** 20 ms interval WebSocket refresh without browser memory bloating.
- **Micro-Interactions & Monitoring:**
  - Engine status badges (`ENGINE ONLINE`, `RUNNING SIMULATION...`, `DISCONNECTED`).
  - Risk exposure and inventory indicator with dynamic color coding (Green/Red/Gray).
- **Integrated Research Lab:**
  - Configurable backtesting (Strategy, Seed, Simulation steps).
  - Out-of-the-box benchmark presets (Standard calibration, High-volatility stress test).
  - Comparative history table of past runs.

---

## Installation & Quick Start

### System Prerequisites
- **Node.js:** Version 18.0.0 or higher ([Download](https://nodejs.org/)).
- **C++20 Compiler:** 
  - **Linux / macOS:** GCC 10+ (`g++`), Clang 11+ (`clang++`), or CMake 3.16+.
  - **Windows:** MinGW-w64 (via MSYS2 / WinLibs), Clang, or Visual Studio Build Tools (`cl.exe`).

### 1. Clone Repository
```bash
git clone https://github.com/your-account/adaptive-market-making-engine.git
cd adaptive-market-making-engine
```

### 2. Install Node.js Dependencies
```bash
npm install
```

### 3. Compile C++ Core Engine (Cross-Platform)
The automatic build script detects your operating system and available compiler (CMake, g++, clang++, cl.exe):
```bash
npm run build:cpp
```
*The executable binary will be generated directly in `cpp/mm_engine` (or `cpp/mm_engine.exe` on Windows).*

### 4. Launch Terminal
```bash
npm run dev
```
Open your browser at: **`http://localhost:3000`**.

---

## Reproducibility & Research Lab (Determinism)

Validating a quantitative strategy requires **perfect experimental reproducibility**.

All stochastic variables in the engine (noise order generation, order sizes, execution direction) are initialized using a **Mersenne Twister 64-bit generator (`std::mt19937_64`)** driven by the `--seed` parameter.

### Command Line Verification Example:
```bash
# Run 1
./cpp/mm_engine --strategy InventoryAware --seed 42 --duration 500

# Run 2 (strictly identical)
./cpp/mm_engine --strategy InventoryAware --seed 42 --duration 500
```
*Expected result: Final P&L, max drawdown, trade count, and traded volume strictly identical to the cent.*

---

## Model Assumptions & Limitations (Quantitative Disclaimer)

To maintain methodological rigor, the following simplifications are documented:
1. **Queue Position:** The current matching engine executes limit orders against the book using aggregated price-level matching. It does not simulate exact FIFO cancellation/insertion queue positioning.
2. **Network Latency & Colocation:** Order submission latency to the book is treated as zero (no transit delay or network slippage model).
3. **Fee Structure:** The model does not apply asymmetric maker rebates / taker fees; cash flows are gross of exchange commissions.
4. **Simulated Taker Flow:** Adverse market orders originate from a Gaussian white noise stochastic model (*Noise Trader*), uncoupled from live external market data feeds (L3 PCAP/ITCH).

---

## Technical Challenges & Engineering Solutions

During the development and production deployment of this **Quantitative Market-Making Engine** (C++20, Node.js & React), several system and architecture challenges were resolved:

### 1. Simulation Engine Resilience (C++20 Fallback)
- **Problem:** In certain lightweight cloud containers, native compilation tools (`g++`, `cmake`) are not pre-installed, preventing the startup compilation of the C++ high-frequency binary (`mm_engine`) (`Binary not found`).
- **Solution:** 
  - Dynamic installation of essential packages (`build-essential`, `cmake`) when required.
  - Implementation of an **automatic fallback system**: if the C++ binary is unavailable, the Node.js server transparently switches to a high-fidelity TypeScript quantitative simulation engine (`engine_simulator.ts`), guaranteeing zero downtime.

### 2. Cloud Run Deployment & ESM/CJS Bundling
- **Problem:** When running in production on Google Cloud Run with Node.js in native ESM mode, local module import errors (`ERR_MODULE_NOT_FOUND`) occurred on extensionless paths.
- **Solution:** Implementation of a unified build pipeline using **`esbuild`**. It compiles and bundles the entire TypeScript server into a single standalone CommonJS bundle (`dist/server.cjs`), ensuring instant startup without module resolution errors.

### 3. WebSocket Stability & Smart Reconnection
- **Problem:** Transient `[WS] WebSocket error` messages appeared during page hot-reloading (HMR) or dev server micro-reboots.
- **Solution:** Implementation of client-side **exponential backoff reconnection** and clean server-side stream cleanup to absorb proxy disconnections without impacting user experience.

### 4. UI Integrity & React Re-rendering
- **Problem:** Duplicate key warnings (`Encountered two children with the same key`) occurred during rapid successive backtests due to timestamp truncation (`Date.now().toString().slice(-4)`).
- **Solution:** Creation of a persistent incremented unique ID (`RUN-${Date.now()}-${runNum}`) coupled with run deduplication logic in the React state.

---

## Roadmap & Future Evolution

### Version 2.0 (Short Term - Functional & Infra Improvements)
- **Historical Backtesting & Replay:** Loading real market data (CSV/Parquet) and millisecond-level Order Book Replay.
- **Advanced Visualization:** Addition of a liquidity Heatmap and real-time Market Depth Chart in the React dashboard.
- **DevOps Optimization:** Multi-stage Docker image with pre-compiled native C++20 binary for 100% native Cloud Run deployment.
- **Profile Manager:** Export/Import of strategy configurations and risk profiles in JSON format.

### Version 3.0 (Medium Term - Quant & Artificial Intelligence)
- **RL Market Making (Reinforcement Learning):** Training a reinforcement learning agent (Q-Learning / PPO) for dynamic spread adjustment.
- **Advanced Quantitative Models:** Implementation of the Avellaneda-Stoikov strategy and Toxic Flow / Adverse Selection detection.
- **Risk Management & VaR:** Real-time Value at Risk (VaR) calculation with an automatic Kill Switch mechanism upon drawdown breach.
- **Network Latency Simulation:** Delay injection module (5ms - 50ms) and order rejection simulation to test real-world resilience.

### Version 4.0 (Long Term - Institutional Connectivity & Multi-User)
- **Live Connectors (FIX Protocol):** Integration of the FIX protocol and binary WebSockets (Protobuf) for connecting to real exchanges (Binance, Coinbase Prime).
- **Multi-Account & Multi-Asset Support:** Parallel management of multiple asset pairs (BTC/USDT, ETH/USDT) and execution sub-accounts.
- **Role-Based Access Control (RBAC):** Access separation in the React interface (Roles: Quant, Risk Manager, Observer).
- **Data Science Export:** Direct export of simulation sessions to Parquet/HDF5 format for advanced analysis in Python (Pandas/Polars/Jupyter).

---

## License
This project is distributed under the MIT License. Free to use for research, learning, and portfolio presentation purposes.
