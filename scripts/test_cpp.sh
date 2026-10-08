#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/trade-cpp-tests"
mkdir -p "$BUILD_DIR"
cd "$ROOT_DIR"

g++ -std=c++20 -Wall -Wextra -Wpedantic -fsanitize=address,undefined -O1 -g \
  -Icpp/orderbook -Icpp/matching -Icpp/simulator \
  cpp/tests/unit_test_main.cpp \
  cpp/orderbook/order_book.cpp cpp/matching/matching_engine.cpp \
  cpp/simulator/market.cpp cpp/simulator/risk_engine.cpp \
  -o "$BUILD_DIR/unit_tests"

ASAN_OPTIONS=detect_leaks=1 UBSAN_OPTIONS=halt_on_error=1 "$BUILD_DIR/unit_tests"
