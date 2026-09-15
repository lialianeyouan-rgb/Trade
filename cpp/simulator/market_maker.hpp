#pragma once
#include "../orderbook/order.hpp"
#include "../simulator/market.hpp"

class MarketMaker {
public:
    virtual ~MarketMaker() = default;
    virtual void update(const Market& market) = 0;
};
