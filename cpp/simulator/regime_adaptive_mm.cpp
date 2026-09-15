#include "regime_adaptive_mm.hpp"
#include "feature_engine.hpp"

void RegimeAdaptiveMM::update(const Market& market) {
    auto features = FeatureEngine::calculate(market.get_book());
    
    // Simple Regime Detection: high vol threshold
    if (features.vol > 0.0005) {
        vol_mm.update(market);
    } else {
        fixed_mm.update(market);
    }
}

std::vector<Order> RegimeAdaptiveMM::get_orders() const {
    // This is a bit simplified, usually you'd track which strategy is active
    auto orders = fixed_mm.get_orders();
    auto vol_orders = vol_mm.get_orders();
    orders.insert(orders.end(), vol_orders.begin(), vol_orders.end());
    return orders;
}
