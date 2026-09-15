#pragma once
#include "../orderbook/order_book.hpp"
#include "../matching/matching_engine.hpp"
#include <vector>

class Market {
public:
    void process_order(Order& order);
    const OrderBook& get_book() const { return book; }

private:
    OrderBook book;
    MatchingEngine matching_engine;
};
