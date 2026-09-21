#pragma once
#include "../orderbook/order.hpp"
#include "trader.hpp"
#include <random>
#include <vector>
#include <cstdint>

class NoiseTrader : public Trader {
public:
    NoiseTrader(uint64_t id_start, double initial_price, double volatility, uint64_t seed = 42) 
        : id_counter(id_start), current_price(initial_price), volatility(volatility), gen(seed) {}
    
    Order generate_order(uint64_t timestamp) override;

    // Generates a cancellation for an active order with specified probability (e.g. 80-85%)
    // Returns order_id to cancel, or 0 if no cancel
    uint64_t maybe_cancel_order(double cancel_prob = 0.85);

    void on_order_matched_or_cancelled(uint64_t order_id);

    void update_mid_price(double new_mid) {
        if (new_mid > 10.0) {
            current_price = new_mid;
        }
    }

    void apply_shock(double delta) {
        current_price += delta;
    }

    double get_current_price() const { return current_price; }

private:
    uint64_t id_counter;
    double current_price;
    double volatility;
    std::mt19937_64 gen;
    std::vector<uint64_t> active_order_ids;
};
