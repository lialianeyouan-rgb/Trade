#pragma once
#include "market_maker.hpp"
#include "risk_engine.hpp"

class InventoryAwareMM : public MarketMaker {
public:
    InventoryAwareMM(double spread, uint64_t size, uint64_t id_start, double skew_factor, const RiskEngine& risk) 
        : spread(spread), size(size), id_counter(id_start), skew_factor(skew_factor), risk(risk) {}

    void update(const Market& market) override;

private:
    double spread;
    uint64_t size;
    uint64_t id_counter;
    double skew_factor;
    const RiskEngine& risk;
};
