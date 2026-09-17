#include "order_book.hpp"

void OrderBook::add_order(const Order& order) {
    if (order.side == Side::BUY) {
        bids[order.price].push_back(order);
        order_id_map[order.id] = {true, order.price, --bids[order.price].end()};
    } else {
        asks[order.price].push_back(order);
        order_id_map[order.id] = {false, order.price, --asks[order.price].end()};
    }
}

void OrderBook::cancel_order(uint64_t order_id) {
    auto it = order_id_map.find(order_id);
    if (it == order_id_map.end()) return;

    OrderLocation loc = it->second;
    if (loc.is_bid) {
        bids[loc.price].erase(loc.it);
        if (bids[loc.price].empty()) bids.erase(loc.price);
    } else {
        asks[loc.price].erase(loc.it);
        if (asks[loc.price].empty()) asks.erase(loc.price);
    }
    order_id_map.erase(it);
}
void OrderBook::cancel_orders_by_trader(uint32_t trader_id) {
    std::vector<uint64_t> to_cancel;
    for (const auto& pair : order_id_map) {
        if (pair.second.it->trader_id == trader_id) {
            to_cancel.push_back(pair.first);
        }
    }
    for (uint64_t id : to_cancel) {
        cancel_order(id);
    }
}
