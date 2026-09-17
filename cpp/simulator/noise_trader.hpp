#pragma once
#include "../orderbook/order.hpp"
#include "trader.hpp"
#include <random>

class NoiseTrader : public Trader {
public:
    NoiseTrader(uint64_t id_start, double initial_price, double volatility, uint64_t seed = std::random_device{}()) 
        : id_counter(id_start), current_price(initial_price), volatility(volatility), gen(seed) {}
    Order generate_order(uint64_t timestamp) override;
private:
    uint64_t id_counter;
    double current_price;
    double volatility;
    std::mt19937 gen;
    std::normal_distribution<double> price_dist{100.0, 1.0};
};
