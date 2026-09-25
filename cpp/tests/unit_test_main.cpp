#include <iostream>
#include <cassert>
#include <limits>
#include "order_book.hpp"
#include "matching_engine.hpp"
#include "risk_engine.hpp"

void test_cta03_overflow_and_zero_quantity() {
    std::cout << "[Test] CTA-03: Testing UINT64_MAX / overflow and zero quantity rejection..." << std::endl;
    OrderBook book;

    // 1. Zero quantity rejection
    Order zero_order{10, 1000, OrderType::LIMIT, Side::BUY, 100.0, 0, 1000};
    book.add_order(zero_order);
    assert(!book.has_bids());

    // 2. UINT64_MAX overflow rejection (no UB, no cast destruction)
    Order overflow_order{11, 1000, OrderType::LIMIT, Side::BUY, 100.0, std::numeric_limits<uint64_t>::max(), 1001};
    book.add_order(overflow_order);
    assert(!book.has_bids());

    std::cout << "[Test] CTA-03 tests PASSED." << std::endl;
}

void test_cta01_duplicate_order_id() {
    std::cout << "[Test] CTA-01: Testing duplicate order_id rejection and livelock prevention..." << std::endl;
    OrderBook book;

    Order first_order{20, 1000, OrderType::LIMIT, Side::BUY, 101.0, 50, 2000};
    book.add_order(first_order);
    assert(book.has_bids());

    // Duplicate order_id submission (should be rejected/ignored, no livelock)
    Order duplicate_order{20, 1000, OrderType::LIMIT, Side::BUY, 101.0, 30, 2001};
    book.add_order(duplicate_order);

    // Verify quantity at level is still 50 (not overwritten/corrupted)
    const auto& bids = book.get_bids();
    assert(bids.size() == 1);
    assert(bids[0].second[0].quantity == 50);

    std::cout << "[Test] CTA-01 duplicate order tests PASSED." << std::endl;
}

void test_cta07_ownership_cancellation() {
    std::cout << "[Test] CTA-07: Testing ownership verification on cancel_order..." << std::endl;
    OrderBook book;

    // Trader 1000 places an order
    Order order{30, 1000, OrderType::LIMIT, Side::BUY, 102.0, 100, 3000};
    book.add_order(order);
    assert(book.has_bids());

    // Trader 1001 attempts unauthorized cancellation of Trader 1000's order
    book.cancel_order(30, 1001, true);
    assert(book.has_bids()); // Order must still be present (unauthorized cancellation blocked)

    // Trader 1000 (owner) cancels their own order with ownership enforcement
    book.cancel_order(30, 1000, true);
    assert(!book.has_bids()); // Order successfully cancelled

    std::cout << "[Test] CTA-07 ownership cancellation tests PASSED." << std::endl;
}

void test_cta20_risk_engine_unwinding() {
    std::cout << "[Test] CTA-20: Testing native C++ risk engine volatility auto-unwinding..." << std::endl;
    RiskEngine risk(100);

    // Force position to +80
    Order buy_fill{40, 1000, OrderType::LIMIT, Side::BUY, 100.0, 80, 4000};
    risk.update_position(buy_fill, 80);
    assert(risk.get_current_position() == 80);

    // Trigger extreme volatility shock (> 0.05)
    risk.check_and_unwind_volatility(0.08); // 8% volatility shock (> 5% threshold)

    // Position must have autonomously unwound by 50% (from 80 to 40)
    assert(risk.get_current_position() == 40);
    std::cout << "[Test] CTA-20 risk engine unwinding tests PASSED. Final position after unwind: " << risk.get_current_position() << std::endl;
}

int main() {
    std::cout << "=== COMPREHENSIVE NATIVE C++20 UNIT TESTS (ASan & UBSan) ===" << std::endl;
    try {
        test_cta03_overflow_and_zero_quantity();
        test_cta01_duplicate_order_id();
        test_cta07_ownership_cancellation();
        test_cta20_risk_engine_unwinding();
        std::cout << "=== ALL UNIT TESTS COMPLETED AND PASSED SUCCESSFULLY ===" << std::endl;
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "CRITICAL TEST FAILURE: " << e.what() << std::endl;
        return 1;
    }
}
