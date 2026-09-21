#pragma once
#include "market_maker.hpp"

class FixedSpreadMM : public MarketMaker {
public:
    FixedSpreadMM(double spread, uint64_t size, int64_t max_pos) 
        : spread(spread), size(size), max_pos(max_pos) {}
    void update(const Market& market) override;
    void update_params(double new_spread, uint64_t new_size, double new_max_pos = 0.0) override {
        if (new_spread > 0.0) spread = new_spread;
        if (new_size > 0) size = new_size;
        if (new_max_pos > 0.0) max_pos = static_cast<int64_t>(new_max_pos);
    }
private:
    double spread;
    uint64_t size;
    int64_t max_pos;
    inline static uint64_t global_id_counter = 1000000;
};
