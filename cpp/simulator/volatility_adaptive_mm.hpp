#pragma once
#include "market_maker.hpp"

class VolatilityAdaptiveMM : public MarketMaker {
public:
    VolatilityAdaptiveMM(double base_spread, uint64_t base_size, uint64_t id_start) 
        : base_spread(base_spread), base_size(base_size), id_counter(id_start) {}

    void update(const Market& market) override;

    void update_params(double new_spread, uint64_t new_size, double = 0.0) override {
        if (new_spread > 0.0) base_spread = new_spread;
        if (new_size > 0) base_size = new_size;
    }

private:
    double base_spread;
    uint64_t base_size;
    uint64_t id_counter;
};
