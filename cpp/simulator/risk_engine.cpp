#include "risk_engine.hpp"
#include <cmath>

bool RiskEngine::is_order_allowed(const Order& order) const {
    if (killed) return false;

    // Simplified risk check
    int64_t new_pos = current_position + (order.side == Side::BUY ? (int64_t)order.quantity : -(int64_t)order.quantity);
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
