#include "momentum_trader.hpp"

Order MomentumTrader::generate_order(uint64_t timestamp) {
    // Aggressively follow trend
    return {id_counter++, 2, OrderType::MARKET, Side::BUY, 100.0, 50, timestamp};
}
