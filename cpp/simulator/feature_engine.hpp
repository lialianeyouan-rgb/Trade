#pragma once
#include "../orderbook/order_book.hpp"

struct MarketFeatures {
    double mid_price;
    double spread;
    double obi; // Order Book Imbalance
    double vol; // Realized Volatility
};

class FeatureEngine {
public:
    static MarketFeatures calculate(const OrderBook& book);
};
