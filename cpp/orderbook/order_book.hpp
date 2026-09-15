#pragma once
#include "order.hpp"
#include <map>
#include <list>
#include <unordered_map>

class OrderBook {
public:
    void add_order(const Order& order);
    void cancel_order(uint64_t order_id);
    
    // For debugging/testing
    const std::map<double, std::list<Order>, std::greater<double>>& get_bids() const { return bids; }
    const std::map<double, std::list<Order>>& get_asks() const { return asks; }

private:
    std::map<double, std::list<Order>, std::greater<double>> bids; 
    std::map<double, std::list<Order>> asks; 
    
    struct OrderLocation {
        bool is_bid;
        double price;
        std::list<Order>::iterator it;
    };
    std::unordered_map<uint64_t, OrderLocation> order_id_map;
};
