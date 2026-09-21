#pragma once
#include "../orderbook/order_book.hpp"
#include "../matching/matching_engine.hpp"
#include <vector>

class Market {
public:
    std::vector<Trade> process_order(Order& order);
    void cancel_order(uint64_t order_id) { book.cancel_order(order_id); }
    void cancel_orders_by_trader(uint32_t trader_id) { book.cancel_orders_by_trader(trader_id); }
    const OrderBook& get_book() const { return book; }
private:
    OrderBook book;
    MatchingEngine matching_engine;
};
