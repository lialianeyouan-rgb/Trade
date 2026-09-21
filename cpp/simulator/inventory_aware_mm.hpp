#pragma once
#include "market_maker.hpp"
#include "risk_engine.hpp"

class InventoryAwareMM : public MarketMaker {
public:
    InventoryAwareMM(double spread, uint64_t size, uint64_t id_start, double skew_factor, const RiskEngine& risk) 
        : spread(spread), size(size), id_counter(id_start), skew_factor(skew_factor), risk(risk) {}

    void update(const Market& market) override;

    void update_params(double new_spread, uint64_t new_size, double new_skew_factor = 0.0) override {
        if (new_spread > 0.0) spread = new_spread;
        if (new_size > 0) size = new_size;
        if (new_skew_factor > 0.0) skew_factor = new_skew_factor;
    }

private:
    double spread;
    uint64_t size;
    uint64_t id_counter;
    double skew_factor;
    const RiskEngine& risk;
};
