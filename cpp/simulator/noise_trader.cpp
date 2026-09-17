#include "noise_trader.hpp"

Order NoiseTrader::generate_order(uint64_t timestamp) {
    Order order;
    order.id = id_counter++;
    order.trader_id = 0; // 0 for NoiseTrader
    order.type = OrderType::LIMIT;
    order.side = (std::uniform_int_distribution<int>(0, 1)(gen) == 0) ? Side::BUY : Side::SELL;
    order.price = price_dist(gen);
    order.quantity = std::uniform_int_distribution<uint64_t>(1, 100)(gen);
    order.timestamp = timestamp;
    return order;
}
