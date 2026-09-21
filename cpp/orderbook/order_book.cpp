#include "order_book.hpp"
#include <cmath>
#include <algorithm>

void OrderBook::add_order(const Order& order) {
    Order order_to_add = order;
    if (order.side == Side::BUY) {
        // Bids sorted descending: highest price at front
        auto it = std::lower_bound(bids.begin(), bids.end(), order.price, [](const PriceLevel& a, double p) {
            return a.first > p;
        });
        if (it != bids.end() && std::abs(it->first - order.price) < 1e-7) {
            // Count volume already present ahead at this price level
            uint64_t v_ahead = 0;
            for (const auto& existing : it->second) {
                v_ahead += existing.quantity;
            }
            order_to_add.queue_ahead = v_ahead;
            it->second.push_back(order_to_add);
        } else {
            order_to_add.queue_ahead = 0;
            bids.insert(it, {order.price, {order_to_add}});
        }
        order_id_map[order.id] = {true, order.price};
    } else {
        // Asks sorted ascending: lowest price at front
        auto it = std::lower_bound(asks.begin(), asks.end(), order.price, [](const PriceLevel& a, double p) {
            return a.first < p;
        });
        if (it != asks.end() && std::abs(it->first - order.price) < 1e-7) {
            // Count volume already present ahead at this price level
            uint64_t v_ahead = 0;
            for (const auto& existing : it->second) {
                v_ahead += existing.quantity;
            }
            order_to_add.queue_ahead = v_ahead;
            it->second.push_back(order_to_add);
        } else {
            order_to_add.queue_ahead = 0;
            asks.insert(it, {order.price, {order_to_add}});
        }
        order_id_map[order.id] = {false, order.price};
    }
}

void OrderBook::cancel_order(uint64_t order_id) {
    auto map_it = order_id_map.find(order_id);
    if (map_it == order_id_map.end()) return;

    OrderLocation loc = map_it->second;
    if (loc.is_bid) {
        auto it = std::lower_bound(bids.begin(), bids.end(), loc.price, [](const PriceLevel& a, double p) {
            return a.first > p;
        });
        if (it != bids.end() && std::abs(it->first - loc.price) < 1e-7) {
            auto& orders = it->second;
            orders.erase(std::remove_if(orders.begin(), orders.end(), [order_id](const Order& o) {
                return o.id == order_id;
            }), orders.end());
            if (orders.empty()) {
                bids.erase(it);
            }
        }
    } else {
        auto it = std::lower_bound(asks.begin(), asks.end(), loc.price, [](const PriceLevel& a, double p) {
            return a.first < p;
        });
        if (it != asks.end() && std::abs(it->first - loc.price) < 1e-7) {
            auto& orders = it->second;
            orders.erase(std::remove_if(orders.begin(), orders.end(), [order_id](const Order& o) {
                return o.id == order_id;
            }), orders.end());
            if (orders.empty()) {
                asks.erase(it);
            }
        }
    }
    order_id_map.erase(map_it);
}

void OrderBook::cancel_orders_by_trader(uint32_t trader_id) {
    std::vector<uint64_t> to_cancel;
    for (auto bit = bids.begin(); bit != bids.end();) {
        auto& orders = bit->second;
        for (const auto& o : orders) {
            if (o.trader_id == trader_id) {
                to_cancel.push_back(o.id);
            }
        }
        orders.erase(std::remove_if(orders.begin(), orders.end(), [trader_id](const Order& o) {
            return o.trader_id == trader_id;
        }), orders.end());
        if (orders.empty()) {
            bit = bids.erase(bit);
        } else {
            ++bit;
        }
    }
    for (auto ait = asks.begin(); ait != asks.end();) {
        auto& orders = ait->second;
        for (const auto& o : orders) {
            if (o.trader_id == trader_id) {
                to_cancel.push_back(o.id);
            }
        }
        orders.erase(std::remove_if(orders.begin(), orders.end(), [trader_id](const Order& o) {
            return o.trader_id == trader_id;
        }), orders.end());
        if (orders.empty()) {
            ait = asks.erase(ait);
        } else {
            ++ait;
        }
    }
    for (uint64_t id : to_cancel) {
        order_id_map.erase(id);
    }
}

