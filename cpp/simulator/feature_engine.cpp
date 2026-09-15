#include "feature_engine.hpp"
#include <cmath>
#include <deque>

static std::deque<double> price_history;
const size_t WINDOW_SIZE = 50;

MarketFeatures FeatureEngine::calculate(const OrderBook& book) {
    double best_bid = book.get_bids().empty() ? 0.0 : book.get_bids().begin()->first;
    double best_ask = book.get_asks().empty() ? 0.0 : book.get_asks().begin()->first;
    
    double mid = (best_bid + best_ask) / 2.0;
    if (mid > 0) {
        price_history.push_back(mid);
        if (price_history.size() > WINDOW_SIZE) price_history.pop_front();
    }
    
    double spread = best_ask - best_bid;
    
    double bid_vol = 0;
    if(!book.get_bids().empty()) {
        for(const auto& order : book.get_bids().begin()->second) bid_vol += order.quantity;
    }
    
    double ask_vol = 0;
    if(!book.get_asks().empty()) {
        for(const auto& order : book.get_asks().begin()->second) ask_vol += order.quantity;
    }
    
    double obi = (bid_vol + ask_vol == 0) ? 0 : (bid_vol - ask_vol) / (bid_vol + ask_vol);
    
    double vol = 0.0;
    if (price_history.size() > 1) {
        double sum_sq_diff = 0;
        for (size_t i = 1; i < price_history.size(); ++i) {
            double ret = (price_history[i] - price_history[i-1]) / price_history[i-1];
            sum_sq_diff += ret * ret;
        }
        vol = std::sqrt(sum_sq_diff / (price_history.size() - 1));
    }
    
    return {mid, spread, obi, vol};
}
