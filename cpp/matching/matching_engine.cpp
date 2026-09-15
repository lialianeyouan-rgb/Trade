#include "matching_engine.hpp"
#include <iostream>
#include <algorithm>

void MatchingEngine::match(OrderBook& book, Order& incoming_order) {
    // Basic price-time matching
    auto& bids = const_cast<std::map<double, std::list<Order>, std::greater<double>>&>(book.get_bids());
    auto& asks = const_cast<std::map<double, std::list<Order>>&>(book.get_asks());

    if (incoming_order.side == Side::BUY) {
        while (!asks.empty() && incoming_order.price >= asks.begin()->first && incoming_order.quantity > 0) {
            auto& ask_level = asks.begin()->second;
            Order& ask = ask_level.front();
            uint64_t matched_qty = std::min(incoming_order.quantity, ask.quantity);
            std::cout << "Matched: " << matched_qty << " @ " << ask.price << std::endl;
            incoming_order.quantity -= matched_qty;
            ask.quantity -= matched_qty;
            if (ask.quantity == 0) ask_level.pop_front();
            if (ask_level.empty()) asks.erase(asks.begin());
        }
    } else {
        while (!bids.empty() && incoming_order.price <= bids.begin()->first && incoming_order.quantity > 0) {
            auto& bid_level = bids.begin()->second;
            Order& bid = bid_level.front();
            uint64_t matched_qty = std::min(incoming_order.quantity, bid.quantity);
            std::cout << "Matched: " << matched_qty << " @ " << bid.price << std::endl;
            incoming_order.quantity -= matched_qty;
            bid.quantity -= matched_qty;
            if (bid.quantity == 0) bid_level.pop_front();
            if (bid_level.empty()) bids.erase(bids.begin());
        }
    }
}
