#include "risk_engine.hpp"
#include <cmath>
#include <algorithm>

bool RiskEngine::is_order_allowed(const Order& order) const {
    if (killed) return false;

    // Hard inventory constraint check
    int64_t new_pos = current_position + (order.side == Side::BUY ? static_cast<int64_t>(order.quantity) : -static_cast<int64_t>(order.quantity));
    if (std::abs(new_pos) > max_position) return false;
    
    return true;
}

void RiskEngine::update_position(const Order& order, uint64_t filled_qty) {
    if (order.side == Side::BUY) {
        current_position += filled_qty;
    } else {
        current_position -= filled_qty;
    }
}

double RiskEngine::calculate_var_95(double mid_price, double volatility) const {
    if (current_position == 0) return 0.0;
    double vol = std::max(0.0001, volatility);
    double mid = std::max(0.01, mid_price);
    return 1.645 * static_cast<double>(std::abs(current_position)) * mid * vol;
}

double RiskEngine::calculate_reservation_price(double mid_price, double volatility, double remaining_time) const {
    double vol = std::max(0.0001, volatility);
    double skew = static_cast<double>(current_position) * gamma * (vol * vol) * remaining_time;
    return mid_price - skew;
}

double RiskEngine::calculate_skew_impact(double volatility, double remaining_time) const {
    double vol = std::max(0.0001, volatility);
    return static_cast<double>(current_position) * gamma * (vol * vol) * remaining_time;
}
