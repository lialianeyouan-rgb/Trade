#pragma once
#include "trader.hpp"
#include <random>

class NoiseTrader : public Trader {
public:
    NoiseTrader(uint64_t id_start, double price_mean, double price_std)
        : id_counter(id_start), price_dist(price_mean, price_std), gen(std::random_device{}()) {}

    Order generate_order(uint64_t timestamp) override;

private:
    uint64_t id_counter;
    std::normal_distribution<double> price_dist;
    std::mt19937 gen;
};
