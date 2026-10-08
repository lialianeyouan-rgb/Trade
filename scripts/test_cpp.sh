#!/usr/bin/env bash
set -e
echo "=== Compiling C++ Unit Tests with ASan & UBSan ==="
g++ -std=c++20 -fsanitize=address,undefined -O3 -Icpp/orderbook -Icpp/matching -Icpp/simulator cpp/tests/unit_test_main.cpp cpp/orderbook/order_book.cpp cpp/matching/matching_engine.cpp cpp/simulator/risk_engine.cpp -o /tmp/unit_tests

echo "=== Running C++ Unit Tests ==="
/tmp/unit_tests
echo "=== All C++ Unit Tests PASSED ==="
