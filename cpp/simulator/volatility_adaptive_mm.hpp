#pragma once
#include "market_maker.hpp"

class VolatilityAdaptiveMM : public MarketMaker {
public:
    VolatilityAdaptiveMM(double base_spread, uint64_t base_size, uint64_t id_start) 
        : base_spread(base_spread), base_size(base_size), id_counter(id_start) {}

    void update(const Market& market) override;
    std::vector<Order> get_orders() const { return orders; }

private:
    double base_spread;
    uint64_t base_size;
    uint64_t id_counter;
    std::vector<Order> orders;
};
