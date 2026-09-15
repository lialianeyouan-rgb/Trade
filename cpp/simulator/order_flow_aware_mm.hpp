#pragma once
#include "market_maker.hpp"
#include "feature_engine.hpp"

class OrderFlowAwareMM : public MarketMaker {
public:
    OrderFlowAwareMM(double spread, uint64_t size, uint64_t id_start, double flow_factor) 
        : spread(spread), size(size), id_counter(id_start), flow_factor(flow_factor) {}

    void update(const Market& market) override;
    std::vector<Order> get_orders() const { return orders; }

private:
    double spread;
    uint64_t size;
    uint64_t id_counter;
    double flow_factor;
    std::vector<Order> orders;
};
