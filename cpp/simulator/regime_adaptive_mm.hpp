#pragma once
#include "market_maker.hpp"
#include "fixed_spread_mm.hpp"
#include "volatility_adaptive_mm.hpp"
#include "feature_engine.hpp"

class RegimeAdaptiveMM : public MarketMaker {
public:
    RegimeAdaptiveMM(double spread, uint64_t size, uint64_t id_start) 
        : fixed_mm(spread, size, id_start), vol_mm(spread, size, id_start + 1000000) {}

    void update(const Market& market) override;

    void update_params(double new_spread, uint64_t new_size, double extra = 0.0) override {
        fixed_mm.update_params(new_spread, new_size, extra);
        vol_mm.update_params(new_spread, new_size, extra);
    }

private:
    FixedSpreadMM fixed_mm;
    VolatilityAdaptiveMM vol_mm;
    enum class Regime { CALM, TRENDING, HIGH_VOL, EVENT };
    Regime current_regime = Regime::CALM;
};
