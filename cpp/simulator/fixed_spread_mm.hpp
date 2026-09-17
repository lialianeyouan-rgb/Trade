#pragma once
#include "market_maker.hpp"

class FixedSpreadMM : public MarketMaker {
public:
    FixedSpreadMM(double spread, uint64_t size, int64_t max_pos) 
        : spread(spread), size(size), max_pos(max_pos) {}
    void update(const Market& market) override;
private:
    double spread;
    uint64_t size;
    int64_t max_pos;
    inline static uint64_t global_id_counter = 1000000;
};
