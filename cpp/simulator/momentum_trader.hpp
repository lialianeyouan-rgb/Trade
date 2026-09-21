#pragma once

#include "trader.hpp"
#include "feature_engine.hpp"
#include <random>

class MomentumTrader : public Trader {
public:
    MomentumTrader(uint64_t id_start, uint32_t trader_id = 2, uint64_t seed = 999);
    Order generate_order(uint64_t timestamp) override;

    bool should_trade(const MarketFeatures& features, uint64_t step);
    Order generate_informed_order(const MarketFeatures& features, uint64_t timestamp);

    bool has_pending_jump() const { return pending_jump; }
    double consume_pending_jump();

private:
    uint64_t id_counter;
    uint32_t trader_id;
    std::mt19937 gen;
    std::uniform_real_distribution<double> unif{0.0, 1.0};
    bool pending_jump;
    double next_jump;
    double last_mid;
};
