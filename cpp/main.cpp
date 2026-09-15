#include <iostream>
#include "simulator/market.hpp"
#include "simulator/noise_trader.hpp"
#include "simulator/fixed_spread_mm.hpp"
#include "simulator/risk_engine.hpp"
#include "simulator/feature_engine.hpp"

int main() {
    Market market;
    RiskEngine risk(100);
    NoiseTrader noise_trader(1, 100.0, 1.0);
    FixedSpreadMM mm_trader(0.1, 10, 100);
    
    std::cout << "Starting simulation with Features..." << std::endl;
    for (uint64_t i = 0; i < 1000; ++i) {
        Order o = noise_trader.generate_order(i);
        market.process_order(o);
        
        mm_trader.update(market);
        for (auto& mm_order : mm_trader.get_orders()) {
            if (risk.is_order_allowed(mm_order)) {
                market.process_order(mm_order);
                risk.update_position(mm_order, mm_order.quantity);
            }
        }
        
        // Print features periodically
        if (i % 100 == 0) {
            auto features = FeatureEngine::calculate(market.get_book());
            std::cout << "Step " << i << " | Mid: " << features.mid_price << " | Spread: " << features.spread << " | OBI: " << features.obi << std::endl;
        }
    }
    
    std::cout << "Simulation finished." << std::endl;
    return 0;
}
