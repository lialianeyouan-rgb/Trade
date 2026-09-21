#pragma once
#include "../orderbook/order.hpp"
#include <cmath>
#include <algorithm>

class RiskEngine {
public:
    RiskEngine(int64_t max_pos, double risk_aversion_gamma = 0.1, double horizon_T = 1.0) 
        : max_position(max_pos), current_position(0), killed(false), gamma(risk_aversion_gamma), T(horizon_T) {}

    bool is_order_allowed(const Order& order) const;
    void update_position(const Order& order, uint64_t filled_qty);
    void kill_switch() { killed = true; }
    void reset_kill_switch() { killed = false; }
    
    int64_t get_current_position() const { return current_position; }
    int64_t get_max_position() const { return max_position; }
    bool is_killed() const { return killed; }

    // Phase 3.2: Value-at-Risk 95% = 1.645 * |q| * mid * vol
    double calculate_var_95(double mid_price, double volatility) const;

    // Phase 3.2: Avellaneda-Stoikov reservation price: r = s - q * gamma * sigma^2 * (T - t)
    double calculate_reservation_price(double mid_price, double volatility, double remaining_time = 1.0) const;

    // Inventory Skew Impact delta: Delta_skew = q * gamma * sigma^2 * (T - t)
    double calculate_skew_impact(double volatility, double remaining_time = 1.0) const;

    double get_gamma() const { return gamma; }
    void set_gamma(double new_gamma) { gamma = std::max(0.0001, new_gamma); }
    void set_max_position(int64_t new_max_pos) { max_position = std::max(int64_t(1), new_max_pos); }

private:
    int64_t max_position;
    int64_t current_position;
    bool killed;
    double gamma;
    double T;
};
