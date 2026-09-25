#pragma once

#include "order.hpp"
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <utility>

// Contiguous price level representation for cache locality (L1/L2)
using PriceLevel = std::pair<double, std::vector<Order>>;

class OrderBook {
public:
    void add_order(const Order& order);
    void cancel_order(uint64_t order_id, uint32_t requester_id = 0, bool enforce_ownership = false);
    void cancel_orders_by_trader(uint32_t trader_id);
    void remove_order_mapping(uint64_t order_id) { order_id_map.erase(order_id); }
    
    // Contiguous accessors
    const std::vector<PriceLevel>& get_bids() const { return bids; }
    std::vector<PriceLevel>& get_mutable_bids() { return bids; }
    
    const std::vector<PriceLevel>& get_asks() const { return asks; }
    std::vector<PriceLevel>& get_mutable_asks() { return asks; }

    bool has_bids() const { return !bids.empty(); }
    bool has_asks() const { return !asks.empty(); }

    double get_best_bid() const { return bids.empty() ? 0.0 : bids.front().first; }
    double get_best_ask() const { return asks.empty() ? 0.0 : asks.front().first; }

private:
    // Bids sorted in descending price order (best bid at index 0)
    std::vector<PriceLevel> bids;
    // Asks sorted in ascending price order (best ask at index 0)
    std::vector<PriceLevel> asks;
    
    struct OrderLocation {
        bool is_bid;
        double price;
        uint32_t trader_id;
    };
    std::unordered_map<uint64_t, OrderLocation> order_id_map;
};
