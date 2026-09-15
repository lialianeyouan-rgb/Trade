#pragma once
#include "trader.hpp"
#include <random>

class MomentumTrader : public Trader {
public:
    MomentumTrader(uint64_t id_start) : id_counter(id_start), gen(std::random_device{}()) {}
    Order generate_order(uint64_t timestamp) override;
private:
    uint64_t id_counter;
    std::mt19937 gen;
};
