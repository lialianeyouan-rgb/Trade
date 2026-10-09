#!/usr/bin/env bash
set -e
echo "=== Building C++ Benchmark Suite ==="
cd cpp
g++ -std=c++20 -O3 -march=native -flto \
  benchmarks/engine_benchmark.cpp \
  orderbook/order_book.cpp \
  matching/matching_engine.cpp \
  simulator/risk_engine.cpp \
  -Iorderbook -Imatching -Isimulator \
  -o /tmp/engine_benchmark
cd ..

echo "=== Executing Micro-Benchmark (Raw Output) ==="
/tmp/engine_benchmark
echo "=== Benchmark Suite Completed Successfully ==="
