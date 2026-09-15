#pragma once
#include "../orderbook/order_book.hpp"

class MatchingEngine {
public:
    void match(OrderBook& book, Order& incoming_order);
};
