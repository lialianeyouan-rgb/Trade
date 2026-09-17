#include "fixed_spread_mm.hpp"
#include <iostream>

void FixedSpreadMM::update(const Market& market) {
    const auto& book = market.get_book();
    orders.clear();
    double best_bid = book.get_bids().empty() ? 99.0 : book.get_bids().begin()->first;
    double best_ask = book.get_asks().empty() ? 101.0 : book.get_asks().begin()->first;
    double mid = (best_bid + best_ask) / 2.0;

    orders.push_back({global_id_counter++, 1, OrderType::LIMIT, Side::BUY, mid - spread / 2.0, size, 0});
    orders.push_back({global_id_counter++, 1, OrderType::LIMIT, Side::SELL, mid + spread / 2.0, size, 0});
}
