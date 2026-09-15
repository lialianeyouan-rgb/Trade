#pragma once
#include "market_maker.hpp"
#include <vector>

class FixedSpreadMM : public MarketMaker {
public:
    FixedSpreadMM(double spread, uint64_t size, uint64_t id_start) 
        : spread(spread), size(size), id_counter(id_start) {}

    void update(const Market& market) override;
    
    std::vector<Order> get_orders() const { return orders; }

private:
    double spread;
    uint64_t size;
    uint64_t id_counter;
    std::vector<Order> orders;
};
