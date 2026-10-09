#include <iostream>
#include <chrono>
#include <vector>
#include <numeric>
#include <algorithm>
#include "order_book.hpp"
#include "matching_engine.hpp"

int main() {
    std::cout << "=== QUANTITATIVE ENGINE MICRO-BENCHMARK (C++20) ===" << std::endl;
    OrderBook book;
    MatchingEngine matching;

    const int ITERATIONS = 100000;
    std::vector<uint64_t> insert_latencies;
    insert_latencies.reserve(ITERATIONS);

    for (int i = 0; i < ITERATIONS; ++i) {
        Order o{static_cast<uint64_t>(1000 + i), 1, OrderType::LIMIT, Side::BUY, 100.0 + (i % 10) * 0.01, 10, static_cast<uint64_t>(1000 + i), 0};
        auto start = std::chrono::high_resolution_clock::now();
        matching.match(book, o);
        auto end = std::chrono::high_resolution_clock::now();
        auto ns = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();
        insert_latencies.push_back(ns);
    }

    std::sort(insert_latencies.begin(), insert_latencies.end());
    uint64_t p50 = insert_latencies[static_cast<size_t>(ITERATIONS * 0.50)];
    uint64_t p90 = insert_latencies[static_cast<size_t>(ITERATIONS * 0.90)];
    uint64_t p99 = insert_latencies[static_cast<size_t>(ITERATIONS * 0.99)];
    uint64_t p999 = insert_latencies[static_cast<size_t>(ITERATIONS * 0.999)];
    double total_ns = std::accumulate(insert_latencies.begin(), insert_latencies.end(), 0.0);
    double throughput = ITERATIONS * 1000000000.0 / total_ns;

    std::cout << "--- RAW BENCHMARK OUTPUT ---" << std::endl;
    std::cout << "Operations: " << ITERATIONS << std::endl;
    std::cout << "p50: " << p50 << " ns" << std::endl;
    std::cout << "p90: " << p90 << " ns" << std::endl;
    std::cout << "p99: " << p99 << " ns" << std::endl;
    std::cout << "p99.9: " << p999 << " ns" << std::endl;
    std::cout << "Throughput: " << static_cast<uint64_t>(throughput) << " ops/sec" << std::endl;
    return 0;
}
