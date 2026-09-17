#include "regime_adaptive_mm.hpp"
#include "feature_engine.hpp"

void RegimeAdaptiveMM::update(const Market& market) {
    auto features = FeatureEngine::calculate(market.get_book());
    
    orders.clear();
    
    // Simple Regime Detection: high vol threshold
    if (features.vol > 0.0005) {
        vol_mm.update(market);
        orders = vol_mm.get_orders();
    } else {
        fixed_mm.update(market);
        orders = fixed_mm.get_orders();
    }
}
