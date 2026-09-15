#include "inventory_aware_mm.hpp"

void InventoryAwareMM::update(const Market& market) {
    const auto& book = market.get_book();
    orders.clear();

    double best_bid = book.get_bids().empty() ? 99.0 : book.get_bids().begin()->first;
    double best_ask = book.get_asks().empty() ? 101.0 : book.get_asks().begin()->first;
    double mid = (best_bid + best_ask) / 2.0;

    // Apply skew
    double skew = -risk.get_current_position() * skew_factor;
    double skewed_mid = mid + skew;

    orders.push_back({id_counter++, OrderType::LIMIT, Side::BUY, skewed_mid - spread / 2.0, size, 0});
    orders.push_back({id_counter++, OrderType::LIMIT, Side::SELL, skewed_mid + spread / 2.0, size, 0});
}
