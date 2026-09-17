#include "matching_engine.hpp"
#include <iostream>
#include <algorithm>

std::vector<Trade> MatchingEngine::match(OrderBook& book, Order& incoming_order) {
    std::vector<Trade> trades;
    auto& bids = const_cast<std::map<double, std::list<Order>, std::greater<double>>&>(book.get_bids());
    auto& asks = const_cast<std::map<double, std::list<Order>>&>(book.get_asks());

    if (incoming_order.side == Side::BUY) {
        while (!asks.empty() && incoming_order.price >= asks.begin()->first && incoming_order.quantity > 0) {
            auto& ask_level = asks.begin()->second;
            Order& ask = ask_level.front();
            uint64_t matched_qty = std::min(incoming_order.quantity, ask.quantity);
            
            trades.push_back({ask.trader_id, incoming_order.trader_id, ask.side, ask.price, matched_qty, incoming_order.timestamp});
            
            incoming_order.quantity -= matched_qty;
            ask.quantity -= matched_qty;

            if (ask.quantity == 0) {
                // Instead of popping directly, let's use the proper cancel/removal if possible.
                // But we can just use book.cancel_order to properly remove it and clean up the map!
                book.cancel_order(ask.id);
            }
        }
    } else {
        while (!bids.empty() && incoming_order.price <= bids.begin()->first && incoming_order.quantity > 0) {
            auto& bid_level = bids.begin()->second;
            Order& bid = bid_level.front();
            uint64_t matched_qty = std::min(incoming_order.quantity, bid.quantity);
            
            trades.push_back({bid.trader_id, incoming_order.trader_id, bid.side, bid.price, matched_qty, incoming_order.timestamp});
            
            incoming_order.quantity -= matched_qty;
            bid.quantity -= matched_qty;

            if (bid.quantity == 0) {
                book.cancel_order(bid.id);
            }
        }
    }
    return trades;
}
