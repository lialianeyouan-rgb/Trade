#pragma once
#include "../orderbook/order.hpp"

class RiskEngine {
public:
    RiskEngine(int64_t max_pos) : max_position(max_pos), current_position(0), killed(false) {}

    bool is_order_allowed(const Order& order) const;
    void update_position(const Order& order, uint64_t filled_qty);
    void kill_switch() { killed = true; }
    
    int64_t get_current_position() const { return current_position; }

private:
    int64_t max_position;
    int64_t current_position;
    bool killed;
};
