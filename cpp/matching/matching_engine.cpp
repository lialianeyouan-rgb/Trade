#include "matching_engine.hpp"
#include <algorithm>

std::vector<Trade> MatchingEngine::match(OrderBook& book, Order& incoming_order) {
    std::vector<Trade> trades;
    auto& bids = book.get_mutable_bids();
    auto& asks = book.get_mutable_asks();

    if (incoming_order.side == Side::BUY) {
        while (!asks.empty() && 
               (incoming_order.type == OrderType::MARKET || incoming_order.price >= asks.front().first) && 
               incoming_order.quantity > 0) {
            auto& ask_level = asks.front().second;
            if (ask_level.empty()) {
                asks.erase(asks.begin());
                continue;
            }
            Order& ask = ask_level.front();
            uint64_t matched_qty = std::min(incoming_order.quantity, ask.quantity);
            double exec_price = ask.price;
            double trade_val = exec_price * static_cast<double>(matched_qty);
            
            // Maker rebate: +0.01% (+1 bps), Taker fee: -0.02% (-2 bps)
            double maker_rebate = trade_val * 0.0001;
            double taker_fee = -trade_val * 0.0002;

            trades.push_back({
                ask.trader_id,
                incoming_order.trader_id,
                ask.side,
                exec_price,
                matched_qty,
                incoming_order.timestamp,
                maker_rebate,
                taker_fee
            });
            
            incoming_order.quantity -= matched_qty;
            ask.quantity -= matched_qty;

            if (ask.quantity == 0) {
                book.remove_order_mapping(ask.id);
                ask_level.erase(ask_level.begin());
                if (ask_level.empty()) {
                    asks.erase(asks.begin());
                }
            }
        }
    } else {
        while (!bids.empty() && 
               (incoming_order.type == OrderType::MARKET || incoming_order.price <= bids.front().first) && 
               incoming_order.quantity > 0) {
            auto& bid_level = bids.front().second;
            if (bid_level.empty()) {
                bids.erase(bids.begin());
                continue;
            }
            Order& bid = bid_level.front();
            uint64_t matched_qty = std::min(incoming_order.quantity, bid.quantity);
            double exec_price = bid.price;
            double trade_val = exec_price * static_cast<double>(matched_qty);

            // Maker rebate: +0.01% (+1 bps), Taker fee: -0.02% (-2 bps)
            double maker_rebate = trade_val * 0.0001;
            double taker_fee = -trade_val * 0.0002;

            trades.push_back({
                bid.trader_id,
                incoming_order.trader_id,
                bid.side,
                exec_price,
                matched_qty,
                incoming_order.timestamp,
                maker_rebate,
                taker_fee
            });
            
            incoming_order.quantity -= matched_qty;
            bid.quantity -= matched_qty;

            if (bid.quantity == 0) {
                book.remove_order_mapping(bid.id);
                bid_level.erase(bid_level.begin());
                if (bid_level.empty()) {
                    bids.erase(bids.begin());
                }
            }
        }
    }
    if (incoming_order.quantity == 0) {
        book.remove_order_mapping(incoming_order.id);
    }
    return trades;
}
