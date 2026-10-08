#!/usr/bin/env bash
set -e
echo "=== Building C++ Benchmark Engine ==="
cd cpp
g++ -std=c++20 -O3 -march=native -flto \
  main.cpp \
  orderbook/order_book.cpp \
  matching/matching_engine.cpp \
  simulator/market.cpp \
  simulator/noise_trader.cpp \
  simulator/fixed_spread_mm.cpp \
  simulator/risk_engine.cpp \
  simulator/feature_engine.cpp \
  simulator/inventory_aware_mm.cpp \
  simulator/volatility_adaptive_mm.cpp \
  simulator/order_flow_aware_mm.cpp \
  simulator/regime_adaptive_mm.cpp \
  simulator/momentum_trader.cpp \
  -Iorderbook -Imatching -Isimulator \
  -o /tmp/mm_engine_latency
cd ..

echo "=== Running Latency & Stress-Test Benchmarks ==="
/tmp/mm_engine_latency --strategy InventoryAware --seed 42 --duration 1000
echo "=== Benchmark Completed Successfully ==="
