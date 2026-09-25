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
    void check_and_unwind_volatility(double volatility);
    void kill_switch() { 
        killed = true; 
        clear_pending_orders(); 
    }
    void reset_kill_switch() { killed = false; }

    void add_pending_order(const Order& order) {
        if (order.side == Side::BUY) {
            pending_buy_volume += order.quantity;
        } else {
            pending_sell_volume += order.quantity;
        }
    }

    void remove_pending_order(const Order& order) {
        if (order.side == Side::BUY) {
            pending_buy_volume = std::max(int64_t(0), pending_buy_volume - static_cast<int64_t>(order.quantity));
        } else {
            pending_sell_volume = std::max(int64_t(0), pending_sell_volume - static_cast<int64_t>(order.quantity));
        }
    }

    void clear_pending_orders() {
        pending_buy_volume = 0;
        pending_sell_volume = 0;
    }

    int64_t get_current_position() const { return current_position; }
    int64_t get_max_position() const { return max_position; }
    bool is_killed() const { return killed; }
    int64_t get_pending_buy_volume() const { return pending_buy_volume; }
    int64_t get_pending_sell_volume() const { return pending_sell_volume; }

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
    int64_t pending_buy_volume = 0;
    int64_t pending_sell_volume = 0;
    bool killed;
    double gamma;
    double T;
};
