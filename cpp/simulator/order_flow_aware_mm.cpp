#include "order_flow_aware_mm.hpp"

void OrderFlowAwareMM::update(const Market& market) {
    auto features = FeatureEngine::calculate(market.get_book());
    orders.clear();

    double mid = features.mid_price;
    // Skew based on OBI
    double skew = features.obi * flow_factor;
    double skewed_mid = mid + skew;

    orders.push_back({id_counter++, OrderType::LIMIT, Side::BUY, skewed_mid - spread / 2.0, size, 0});
    orders.push_back({id_counter++, OrderType::LIMIT, Side::SELL, skewed_mid + spread / 2.0, size, 0});
}
