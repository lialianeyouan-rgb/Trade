#include "noise_trader.hpp"
#include <cmath>
#include <algorithm>

Order NoiseTrader::generate_order(uint64_t timestamp) {
    Order order;
    order.id = id_counter++;
    order.trader_id = 0; // 0 for NoiseTrader
    order.type = OrderType::LIMIT;
    order.side = (std::uniform_int_distribution<int>(0, 1)(gen) == 0) ? Side::BUY : Side::SELL;
    
    // Generate order around current price with Gaussian noise
    double offset = std::normal_distribution<double>(0.0, std::max(0.2, volatility))(gen);
    double p = std::round((current_price + offset) * 100.0) / 100.0;
    if (p <= 0.01) p = 0.01;

    order.price = p;
    order.quantity = std::uniform_int_distribution<uint64_t>(10, 80)(gen);
    order.timestamp = timestamp;

    active_order_ids.push_back(order.id);
    return order;
}

uint64_t NoiseTrader::maybe_cancel_order(double cancel_prob) {
    if (active_order_ids.empty()) return 0;
    
    std::bernoulli_distribution cancel_dist(cancel_prob);
    if (!cancel_dist(gen)) return 0;

    // Pick a random active order to cancel (simulating order churn >80%)
    std::uniform_int_distribution<size_t> idx_dist(0, active_order_ids.size() - 1);
    size_t idx = idx_dist(gen);
    uint64_t cancel_id = active_order_ids[idx];

    // Remove from active list
    active_order_ids.erase(active_order_ids.begin() + idx);
    return cancel_id;
}

void NoiseTrader::on_order_matched_or_cancelled(uint64_t order_id) {
    auto it = std::find(active_order_ids.begin(), active_order_ids.end(), order_id);
    if (it != active_order_ids.end()) {
        active_order_ids.erase(it);
    }
}
