#pragma once
#include "market_maker.hpp"

class VolatilityAdaptiveMM : public MarketMaker {
public:
    VolatilityAdaptiveMM(double base_spread, uint64_t base_size, uint64_t id_start) 
        : base_spread(base_spread), base_size(base_size), id_counter(id_start) {}

    void update(const Market& market) override;

private:
    double base_spread;
    uint64_t base_size;
    uint64_t id_counter;
};
