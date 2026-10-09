#!/usr/bin/env bash
set -e
echo "=== Building C++ Full Audit & Benchmark Suite ==="
cd cpp
g++ -std=c++20 -O3 -march=native -flto \
  benchmarks/engine_benchmark.cpp \
  orderbook/order_book.cpp \
  matching/matching_engine.cpp \
  simulator/market.cpp \
  simulator/noise_trader.cpp \
  simulator/fixed_spread_mm.cpp \
  simulator/inventory_aware_mm.cpp \
  simulator/risk_engine.cpp \
  simulator/feature_engine.cpp \
  -Iorderbook -Imatching -Isimulator \
  -o /tmp/engine_audit_suite
cd ..

echo "=== Executing Full Audit Suite (Tests 1 to 4) ==="
/tmp/engine_audit_suite
echo "=== Audit Suite Completed Successfully ==="
