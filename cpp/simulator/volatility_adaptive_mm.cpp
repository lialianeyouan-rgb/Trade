#include "volatility_adaptive_mm.hpp"
#include "feature_engine.hpp"

void VolatilityAdaptiveMM::update(const Market& market) {
    auto features = FeatureEngine::calculate(market.get_book());
    orders.clear();

    // Adaptive logic: spread increases with volatility, size decreases
    double adjusted_spread = base_spread * (1.0 + features.vol * 10.0);
    uint64_t adjusted_size = static_cast<uint64_t>(base_size / (1.0 + features.vol * 5.0));
    if (adjusted_size < 1) adjusted_size = 1;

    double mid = features.mid_price;

    orders.push_back({global_id_counter++, 1, OrderType::LIMIT, Side::BUY, mid - adjusted_spread / 2.0, adjusted_size, 0});
    orders.push_back({global_id_counter++, 1, OrderType::LIMIT, Side::SELL, mid + adjusted_spread / 2.0, adjusted_size, 0});
}
