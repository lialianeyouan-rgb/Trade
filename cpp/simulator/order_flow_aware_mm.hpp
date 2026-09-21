#pragma once
#include "market_maker.hpp"
#include "feature_engine.hpp"

class OrderFlowAwareMM : public MarketMaker {
public:
    OrderFlowAwareMM(double spread, uint64_t size, uint64_t id_start, double flow_factor) 
        : spread(spread), size(size), id_counter(id_start), flow_factor(flow_factor) {}

    void update(const Market& market) override;

    void update_params(double new_spread, uint64_t new_size, double new_flow_factor = 0.0) override {
        if (new_spread > 0.0) spread = new_spread;
        if (new_size > 0) size = new_size;
        if (new_flow_factor > 0.0) flow_factor = new_flow_factor;
    }

private:
    double spread;
    uint64_t size;
    uint64_t id_counter;
    double flow_factor;
};
