#include "feature_engine.hpp"
#include <cmath>
#include <deque>
#include <algorithm>

static std::deque<double> price_history;
const size_t WINDOW_SIZE = 50;

MarketFeatures FeatureEngine::calculate(const OrderBook& book) {
    bool has_bid = !book.get_bids().empty();
    bool has_ask = !book.get_asks().empty();

    double best_bid = has_bid ? book.get_bids().front().first : 0.0;
    double best_ask = has_ask ? book.get_asks().front().first : 0.0;
    
    double mid = 100.0;
    double spread = 0.10;

    if (has_bid && has_ask) {
        mid = (best_bid + best_ask) / 2.0;
        spread = std::max(0.01, best_ask - best_bid);
    } else if (has_bid) {
        mid = best_bid;
        spread = 0.10;
    } else if (has_ask) {
        mid = best_ask;
        spread = 0.10;
    } else if (!price_history.empty()) {
        mid = price_history.back();
    }

    if (mid > 0.0) {
        price_history.push_back(mid);
        if (price_history.size() > WINDOW_SIZE) price_history.pop_front();
    }
    
    double bid_vol = 0;
    if (has_bid) {
        for (const auto& order : book.get_bids().front().second) bid_vol += order.quantity;
    }
    
    double ask_vol = 0;
    if (has_ask) {
        for (const auto& order : book.get_asks().front().second) ask_vol += order.quantity;
    }
    
    double obi = (bid_vol + ask_vol == 0) ? 0.0 : (bid_vol - ask_vol) / (bid_vol + ask_vol);
    
    double vol = 0.0;
    if (price_history.size() > 1) {
        double sum_sq_diff = 0;
        for (size_t i = 1; i < price_history.size(); ++i) {
            double prev = price_history[i-1];
            if (prev > 0.001) {
                double ret = (price_history[i] - prev) / prev;
                sum_sq_diff += ret * ret;
            }
        }
        vol = std::sqrt(sum_sq_diff / (price_history.size() - 1));
    }
    
    return {mid, spread, obi, vol};
}
