#include <iostream>
#include <thread>
#include <chrono>
#include <vector>
#include <cmath>
#include <string>
#include <map>
#include "simulator/market.hpp"
#include "simulator/noise_trader.hpp"
#include "simulator/fixed_spread_mm.hpp"
#include "simulator/inventory_aware_mm.hpp"
#include "simulator/volatility_adaptive_mm.hpp"
#include "simulator/regime_adaptive_mm.hpp"
#include "simulator/risk_engine.hpp"
#include "simulator/feature_engine.hpp"

struct MMStats {
    int64_t inventory = 0;
    double cash = 0.0;
    uint64_t trades_count = 0;
    uint64_t volume_traded = 0;
    double max_pnl = 0.0;
    double max_drawdown = 0.0;

    void process_trades(const std::vector<Trade>& trades, uint32_t my_id, RiskEngine& risk) {
        for (const auto& t : trades) {
            if (t.maker_id == my_id || t.taker_id == my_id) {
                trades_count++;
                volume_traded += t.quantity;
                bool is_maker = (t.maker_id == my_id);
                Side my_side = is_maker ? t.maker_side : (t.maker_side == Side::BUY ? Side::SELL : Side::BUY);

                // Note: we can just use a dummy order to feed risk.update_position
                Order dummy;
                dummy.side = my_side;
                risk.update_position(dummy, t.quantity);

                if (my_side == Side::BUY) {
                    inventory += t.quantity;
                    cash -= t.quantity * t.price;
                } else {
                    inventory -= t.quantity;
                    cash += t.quantity * t.price;
                }
            }
        }
    }
};

std::string format_order_book(const OrderBook& book) {
    std::string out = "\"order_book\": {\"bids\": [";
    int count = 0;
    for (const auto& pair : book.get_bids()) {
        if (count >= 5) break;
        uint64_t total_qty = 0;
        for (const auto& o : pair.second) total_qty += o.quantity;
        if (count > 0) out += ",";
        out += "{\"price\":" + std::to_string(pair.first) + ",\"quantity\":" + std::to_string(total_qty) + "}";
        count++;
    }
    out += "], \"asks\": [";
    count = 0;
    for (const auto& pair : book.get_asks()) {
        if (count >= 5) break;
        uint64_t total_qty = 0;
        for (const auto& o : pair.second) total_qty += o.quantity;
        if (count > 0) out += ",";
        out += "{\"price\":" + std::to_string(pair.first) + ",\"quantity\":" + std::to_string(total_qty) + "}";
        count++;
    }
    out += "]}";
    return out;
}

int main(int argc, char* argv[]) {
    std::string strategy_name = "FixedSpreadMM";
    uint64_t seed = 42;
    uint64_t duration = 0; // 0 = infinite

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--strategy" && i + 1 < argc) strategy_name = argv[++i];
        else if (arg == "--seed" && i + 1 < argc) seed = std::stoull(argv[++i]);
        else if (arg == "--duration" && i + 1 < argc) duration = std::stoull(argv[++i]);
    }

    Market market;
    int64_t max_pos = 100;
    RiskEngine risk(max_pos);
    NoiseTrader noise_trader(1, 100.0, 1.0, seed);
    
    MarketMaker* mm_trader = nullptr;
    if (strategy_name == "InventoryAware") {
        mm_trader = new InventoryAwareMM(0.1, 10, 100, 0.05, risk); // Skew factor 0.05 per unit
    } else if (strategy_name == "VolatilityAdaptive") {
        mm_trader = new VolatilityAdaptiveMM(0.1, 10, 100);
    } else if (strategy_name == "RegimeAdaptive") {
        mm_trader = new RegimeAdaptiveMM(0.1, 10, 100);
    } else {
        mm_trader = new FixedSpreadMM(0.1, 10, 100);
        strategy_name = "FixedSpreadMM";
    }

    MMStats stats;

    for (uint64_t i = 0; duration == 0 || i < duration; ++i) {
        Order o = noise_trader.generate_order(i);
        auto trades1 = market.process_order(o);
        stats.process_trades(trades1, 1, risk);
        
        market.cancel_orders_by_trader(1);
        mm_trader->update(market);
        
        for (auto& mm_order : mm_trader->get_orders()) {
            if (risk.is_order_allowed(mm_order)) {
                auto trades2 = market.process_order(mm_order);
                stats.process_trades(trades2, 1, risk);
            }
        }
        
        auto features = FeatureEngine::calculate(market.get_book());
        double mid_price = features.mid_price;
        if (std::isnan(mid_price)) mid_price = 100.0;
        
        double unrealized_pnl = stats.inventory * mid_price;
        double total_pnl = stats.cash + unrealized_pnl;
        
        if (total_pnl > stats.max_pnl) stats.max_pnl = total_pnl;
        double drawdown = stats.max_pnl - total_pnl;
        if (drawdown > stats.max_drawdown) stats.max_drawdown = drawdown;

        if (duration == 0) {
            // Output JSON only if running live
            std::cout << "{"
                      << "\"step\": " << i << ", "
                      << "\"market\": {"
                      << "\"mid_price\": " << mid_price << ", "
                      << "\"spread\": " << features.spread << ", "
                      << "\"obi\": " << features.obi << ", "
                      << "\"volatility\": " << features.vol
                      << "}, "
                      << format_order_book(market.get_book()) << ", "
                      << "\"strategy\": {"
                      << "\"name\": \"" << strategy_name << "\", "
                      << "\"regime\": \"NORMAL\", "
                      << "\"inventory\": " << stats.inventory
                      << "}, "
                      << "\"risk\": {"
                      << "\"status\": \"NORMAL\", "
                      << "\"exposure\": " << std::abs(stats.inventory) << ", "
                      << "\"max_exposure\": " << max_pos << ", "
                      << "\"inventory\": " << stats.inventory << ", "
                      << "\"inventory_limit\": " << max_pos << ", "
                      << "\"breach\": false"
                      << "}, "
                      << "\"performance\": {"
                      << "\"realized_pnl\": " << stats.cash << ", "
                      << "\"unrealized_pnl\": " << unrealized_pnl << ", "
                      << "\"total_pnl\": " << total_pnl << ", "
                      << "\"trades_count\": " << stats.trades_count << ", "
                      << "\"volume_traded\": " << stats.volume_traded << ", "
                      << "\"max_drawdown\": " << stats.max_drawdown
                      << "}"
                      << "}" << std::endl;
            std::this_thread::sleep_for(std::chrono::milliseconds(20));
        }
    }
    
    if (duration > 0) {
        std::cout << "{\"type\": \"experiment_complete\", \"results\": {"
                  << "\"pnl\": " << (stats.cash + stats.inventory * 100.0) << ", "
                  << "\"max_drawdown\": " << stats.max_drawdown << ", "
                  << "\"trades_count\": " << stats.trades_count << ", "
                  << "\"volume_traded\": " << stats.volume_traded
                  << "}}" << std::endl;
    }

    delete mm_trader;
    return 0;
}
