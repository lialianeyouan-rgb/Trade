#pragma once
#include "../orderbook/order.hpp"
#include "../simulator/market.hpp"
#include <vector>

class MarketMaker {
public:
    virtual ~MarketMaker() = default;
    virtual void update(const Market& market) = 0;
    virtual std::vector<Order> get_orders() const { return orders; }
protected:
    std::vector<Order> orders;
    inline static uint64_t global_id_counter = 1000000;
};
