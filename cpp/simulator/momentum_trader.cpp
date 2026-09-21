#include "momentum_trader.hpp"
#include <cmath>

MomentumTrader::MomentumTrader(uint64_t id_start, uint32_t t_id, uint64_t seed)
    : id_counter(id_start), trader_id(t_id), gen(seed), pending_jump(false), next_jump(0.0), last_mid(100.0) {}

Order MomentumTrader::generate_order(uint64_t timestamp) {
    // Default fallback simple order
    return {id_counter++, trader_id, OrderType::MARKET, Side::BUY, 0.0, 50, timestamp};
}

bool MomentumTrader::should_trade(const MarketFeatures& features, uint64_t step) {
    if (features.mid_price > 0) {
        last_mid = features.mid_price;
    }
    // Trade on strong order book imbalance or periodic informed jumps
    bool obi_signal = std::abs(features.obi) > 0.35;
    bool periodic_shock = (step % 25 == 0);
    
    // Check if an adverse jump should be scheduled
    if (step > 0 && step % 75 == 0) {
        pending_jump = true;
        // Direction follows momentum or alternates
        next_jump = (unif(gen) > 0.5 ? 1.0 : -1.0) * (0.8 + unif(gen) * 0.7);
        return true;
    }

    return obi_signal || periodic_shock;
}

Order MomentumTrader::generate_informed_order(const MarketFeatures& features, uint64_t timestamp) {
    Side side = Side::BUY;

    if (pending_jump) {
        // Trade in the direction of the upcoming jump (classic adverse selection)
        side = (next_jump > 0) ? Side::BUY : Side::SELL;
    } else if (features.obi > 0.2) {
        side = Side::BUY;
    } else if (features.obi < -0.2) {
        side = Side::SELL;
    } else {
        side = (unif(gen) > 0.5) ? Side::BUY : Side::SELL;
    }

    // Large order size consuming multiple book depth levels (50 to 120 shares)
    uint64_t qty = static_cast<uint64_t>(50 + std::floor(unif(gen) * 70));

    Order o;
    o.id = id_counter++;
    o.trader_id = trader_id;
    o.type = OrderType::MARKET; // Aggressive taker order
    o.side = side;
    o.price = 0.0; // Execution determined by resting limit prices in book
    o.quantity = qty;
    o.timestamp = timestamp;
    return o;
}

double MomentumTrader::consume_pending_jump() {
    if (!pending_jump) return 0.0;
    pending_jump = false;
    double j = next_jump;
    next_jump = 0.0;
    return j;
}
