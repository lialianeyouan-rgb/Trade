#pragma once
#include "../orderbook/order.hpp"

class Trader {
public:
    virtual ~Trader() = default;
    virtual Order generate_order(uint64_t timestamp) = 0;
};
