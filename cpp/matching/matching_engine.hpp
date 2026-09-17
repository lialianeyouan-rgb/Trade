#pragma once
#include "../orderbook/order_book.hpp"
#include <vector>

class MatchingEngine {
public:
    std::vector<Trade> match(OrderBook& book, Order& incoming_order);
};
