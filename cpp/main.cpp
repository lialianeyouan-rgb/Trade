#include <iostream>
#include <thread>
#include <chrono>
#include <vector>
#include <cmath>
#include <string>
#include <iomanip>
#include <atomic>
#include <mutex>
#include <deque>
#include <sstream>
#include <algorithm>
#include "simulator/market.hpp"
#include "simulator/noise_trader.hpp"
#include "simulator/momentum_trader.hpp"
#include "simulator/latency_buffer.hpp"
#include "simulator/fixed_spread_mm.hpp"
#include "simulator/inventory_aware_mm.hpp"
#include "simulator/volatility_adaptive_mm.hpp"
#include "simulator/regime_adaptive_mm.hpp"
#include "simulator/risk_engine.hpp"
#include "simulator/feature_engine.hpp"
#include "simulator/csv_market_data_reader.hpp"

// Helper function to sanitize floating point values for JSON compliance
inline double safe_json_double(double val) {
    if (std::isnan(val) || std::isinf(val)) {
        return 0.0;
    }
    return val;
}

// Execution record to measure adverse selection & price impact
struct MMTradeRecord {
    uint64_t step;
    Side side;
    double price;
    uint64_t quantity;
    bool is_maker;
    double mid_at_exec;
};

struct MMStats {
    int64_t inventory = 0;
    double cash = 0.0;
    double total_maker_rebates = 0.0;
    double total_taker_fees = 0.0;
    uint64_t trades_count = 0;
    uint64_t volume_traded = 0;
    double max_pnl = 0.0;
    double max_drawdown = 0.0;

    // Advanced High-Frequency Metrics
    std::deque<MMTradeRecord> recent_trades;
    std::vector<double> pnl_returns;
    double prev_pnl = 0.0;
    
    // Inventory half-life tracking
    std::deque<std::pair<uint64_t, int64_t>> inventory_history; // (step, inv)
    
    // Metrics calculated
    double adverse_selection = 0.0; // Price drift against MM post-trade
    double sortino_ratio = 0.0;
    double inventory_half_life = 0.0;

    void process_trades(const std::vector<Trade>& trades, uint32_t my_id, RiskEngine& risk, uint64_t current_step, double current_mid) {
        for (const auto& t : trades) {
            if (t.maker_id == my_id || t.taker_id == my_id) {
                trades_count++;
                volume_traded += t.quantity;
                bool is_maker = (t.maker_id == my_id);
                Side my_side = is_maker ? t.maker_side : (t.maker_side == Side::BUY ? Side::SELL : Side::BUY);

                Order dummy;
                dummy.side = my_side;
                risk.update_position(dummy, t.quantity);

                if (my_side == Side::BUY) {
                    inventory += t.quantity;
                    cash -= static_cast<double>(t.quantity) * t.price;
                } else {
                    inventory -= t.quantity;
                    cash += static_cast<double>(t.quantity) * t.price;
                }

                // Apply Maker Rebate (+0.01% / +1 bps) or Taker Fee (-0.02% / -2 bps)
                if (is_maker) {
                    double rebate = t.maker_rebate;
                    cash += rebate;
                    total_maker_rebates += rebate;
                } else {
                    double fee = t.taker_fee; // negative value
                    cash += fee;
                    total_taker_fees += std::abs(fee);
                }

                // Record trade for adverse selection calculation
                recent_trades.push_back({current_step, my_side, t.price, t.quantity, is_maker, current_mid});
                if (recent_trades.size() > 200) {
                    recent_trades.pop_front();
                }
            }
        }
    }

    void update_hf_metrics(uint64_t current_step, double current_mid, double total_pnl) {
        // 1. PnL return & Sortino Ratio
        double ret = total_pnl - prev_pnl;
        prev_pnl = total_pnl;
        pnl_returns.push_back(ret);
        if (pnl_returns.size() > 500) {
            pnl_returns.erase(pnl_returns.begin());
        }

        if (pnl_returns.size() >= 5) {
            double mean_ret = 0.0;
            for (double r : pnl_returns) mean_ret += r;
            mean_ret /= pnl_returns.size();

            double downside_sq_sum = 0.0;
            size_t downside_count = 0;
            for (double r : pnl_returns) {
                if (r < 0.0) {
                    downside_sq_sum += (r * r);
                    downside_count++;
                }
            }

            if (downside_count > 0 && downside_sq_sum > 1e-9) {
                double downside_dev = std::sqrt(downside_sq_sum / pnl_returns.size());
                sortino_ratio = safe_json_double((mean_ret / downside_dev) * std::sqrt(252.0));
            } else {
                sortino_ratio = (mean_ret > 0.0) ? 1.5 : 0.0;
            }
        }

        // 2. Adverse Selection / Price Impact (5-20 steps post trade)
        // If MM bought at exec_price and mid dropped, or sold and mid rose: toxic flow!
        if (!recent_trades.empty()) {
            double total_impact = 0.0;
            int impact_count = 0;
            for (const auto& tr : recent_trades) {
                if (current_step >= tr.step + 5) { // evaluate after 5 discrete steps (~50ms)
                    double price_change = current_mid - tr.price;
                    // For MM Buy: adverse if current_mid < price (price dropped) => -price_change
                    // For MM Sell: adverse if current_mid > price (price rose) => +price_change
                    double impact = (tr.side == Side::BUY) ? (-price_change) : (price_change);
                    total_impact += impact;
                    impact_count++;
                }
            }
            if (impact_count > 0) {
                adverse_selection = safe_json_double(total_impact / impact_count);
            }
        }

        // 3. Inventory Half-life estimation (autocorrelation of inventory)
        inventory_history.push_back({current_step, inventory});
        if (inventory_history.size() > 100) {
            inventory_history.pop_front();
        }

        if (inventory_history.size() >= 20) {
            // Estimate mean reversion rate via lag-1 autocorrelation: q_t = rho * q_{t-1} + eps
            double sum_x = 0.0, sum_y = 0.0, sum_xx = 0.0, sum_xy = 0.0;
            size_t n = inventory_history.size() - 1;
            for (size_t i = 0; i < n; ++i) {
                double x = static_cast<double>(inventory_history[i].second);
                double y = static_cast<double>(inventory_history[i+1].second);
                sum_x += x;
                sum_y += y;
                sum_xx += x * x;
                sum_xy += x * y;
            }
            double denom = (n * sum_xx - sum_x * sum_x);
            if (std::abs(denom) > 1e-6) {
                double rho = (n * sum_xy - sum_x * sum_y) / denom;
                if (rho > 0.01 && rho < 0.999) {
                    double decay_rate = -std::log(rho);
                    inventory_half_life = safe_json_double(std::log(2.0) / decay_rate);
                } else if (rho >= 0.999) {
                    inventory_half_life = 99.9; // Persistent / high half-life
                } else {
                    inventory_half_life = 1.0;  // Fast mean-reversion
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
        out += "{\"price\":" + std::to_string(safe_json_double(pair.first)) + ",\"quantity\":" + std::to_string(total_qty) + "}";
        count++;
    }
    out += "], \"asks\": [";
    count = 0;
    for (const auto& pair : book.get_asks()) {
        if (count >= 5) break;
        uint64_t total_qty = 0;
        for (const auto& o : pair.second) total_qty += o.quantity;
        if (count > 0) out += ",";
        out += "{\"price\":" + std::to_string(safe_json_double(pair.first)) + ",\"quantity\":" + std::to_string(total_qty) + "}";
        count++;
    }
    out += "]}";
    return out;
}

// Global parameters for thread-safe dynamic hot-reloading
struct EngineParams {
    std::mutex mtx;
    bool updated = false;
    double gamma = 0.1;
    double spread = 0.1;
    uint64_t size = 10;
    int64_t max_pos = 100;
    double skew_factor = 0.05;
};

static EngineParams g_params;
static std::atomic<bool> g_running(true);

// Thread listening for live stdin commands (Hot-reloading)
void stdin_listener_thread() {
    std::string line;
    while (g_running && std::getline(std::cin, line)) {
        if (line.empty()) continue;
        try {
            // Example JSON: {"type": "UPDATE_PARAMS", "gamma": 0.2, "spread": 0.15, "size": 15, "max_pos": 150}
            if (line.find("UPDATE_PARAMS") != std::string::npos) {
                std::lock_guard<std::mutex> lock(g_params.mtx);
                auto extract_double = [](const std::string& str, const std::string& key) -> double {
                    size_t pos = str.find("\"" + key + "\"");
                    if (pos == std::string::npos) return -1.0;
                    size_t colon = str.find(":", pos);
                    if (colon == std::string::npos) return -1.0;
                    size_t comma = str.find_first_of(",}", colon);
                    std::string val_str = str.substr(colon + 1, comma - colon - 1);
                    try { return std::stod(val_str); } catch (...) { return -1.0; }
                };

                double new_gamma = extract_double(line, "gamma");
                double new_spread = extract_double(line, "spread");
                double new_size = extract_double(line, "size");
                double new_max_pos = extract_double(line, "max_pos");
                double new_skew = extract_double(line, "skew_factor");

                if (new_gamma > 0.0) g_params.gamma = new_gamma;
                if (new_spread > 0.0) g_params.spread = new_spread;
                if (new_size > 0.0) g_params.size = static_cast<uint64_t>(new_size);
                if (new_max_pos > 0.0) g_params.max_pos = static_cast<int64_t>(new_max_pos);
                if (new_skew > 0.0) g_params.skew_factor = new_skew;

                g_params.updated = true;
            }
        } catch (...) {
            // Ignore malformed stdin lines
        }
    }
}

int main(int argc, char* argv[]) {
    std::string strategy_name = "FixedSpreadMM";
    uint64_t seed = 42;
    uint64_t duration = 0; // 0 = infinite live stream
    std::string replay_file = "";

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--strategy" && i + 1 < argc) strategy_name = argv[++i];
        else if (arg == "--seed" && i + 1 < argc) seed = std::stoull(argv[++i]);
        else if (arg == "--duration" && i + 1 < argc) duration = std::stoull(argv[++i]);
        else if (arg == "--replay" && i + 1 < argc) replay_file = argv[++i];
    }

    // Launch background stdin thread for live parameter hot-reloading
    std::thread input_th(stdin_listener_thread);
    input_th.detach();

    Market market;
    int64_t max_pos = 100;
    RiskEngine risk(max_pos, 0.1, 1.0); // gamma = 0.1, T = 1.0
    NoiseTrader noise_trader(1, 100.0, 1.0, seed);
    MomentumTrader momentum_trader(1000000, 2, seed + 100);
    LatencyBuffer latency_buffer(5.0, 2.0, seed + 500); // 5ms mean, 2ms jitter
    
    // Optional CSV Market Data Replay reader
    CSVMarketDataReader replay_reader;
    bool is_replay_mode = false;
    if (!replay_file.empty()) {
        is_replay_mode = replay_reader.load_csv(replay_file);
    }

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

    for (uint64_t step = 0; duration == 0 || step < duration; ++step) {
        uint64_t current_time_ms = step * 10; // 10ms per discrete simulation step

        // Hot-Reload parameter changes from stdin thread
        if (g_params.updated) {
            std::lock_guard<std::mutex> lock(g_params.mtx);
            risk.set_gamma(g_params.gamma);
            risk.set_max_position(g_params.max_pos);
            max_pos = g_params.max_pos;
            if (mm_trader) {
                mm_trader->update_params(g_params.spread, g_params.size, g_params.skew_factor);
            }
            g_params.updated = false;
        }

        // 1. Order Injection: Replay Mode vs Noise Trader Mode
        if (is_replay_mode && replay_reader.has_next()) {
            auto evt = replay_reader.next_event();
            if (evt) {
                if (evt->event_type == "ORDER") {
                    Order r_order;
                    r_order.id = evt->order_id;
                    r_order.trader_id = 99; // L2 Market feed trader
                    r_order.type = OrderType::LIMIT;
                    r_order.side = evt->side;
                    r_order.price = evt->price;
                    r_order.quantity = evt->size;
                    r_order.timestamp = current_time_ms;
                    latency_buffer.submit_order(r_order, current_time_ms);
                } else if (evt->event_type == "CANCEL") {
                    latency_buffer.cancel_order(evt->order_id, 99, current_time_ms);
                }
            }
        } else {
            // 1. Noise Trader creates random limit liquidity
            Order noise_order = noise_trader.generate_order(current_time_ms);
            latency_buffer.submit_order(noise_order, current_time_ms);

            // Realistic Microstructure Churn: cancel orders with >80% cancellation rate
            uint64_t cancel_id = noise_trader.maybe_cancel_order(0.85);
            if (cancel_id > 0) {
                latency_buffer.cancel_order(cancel_id, 0, current_time_ms);
            }

            // 2. Informed / Momentum Trader: adverse selection & multi-level sweeps
            auto current_features = FeatureEngine::calculate(market.get_book());
            if (momentum_trader.should_trade(current_features, step)) {
                Order informed_order = momentum_trader.generate_informed_order(current_features, current_time_ms);
                latency_buffer.submit_order(informed_order, current_time_ms);
            }
        }

        // 3. Market Maker cancels stale quotes and quotes new two-sided limits
        latency_buffer.cancel_trader_orders(1, current_time_ms);
        mm_trader->update(market);
        for (auto& mm_order : mm_trader->get_orders()) {
            if (risk.is_order_allowed(mm_order)) {
                latency_buffer.submit_order(mm_order, current_time_ms);
            }
        }

        // 4. Drain all actions that have arrived at or before current_time_ms through network jitter queue
        auto current_mid_estimate = FeatureEngine::calculate(market.get_book()).mid_price;
        if (std::isnan(current_mid_estimate) || current_mid_estimate <= 0.0) {
            current_mid_estimate = noise_trader.get_current_price();
        }

        auto executed_trades = latency_buffer.drain_due_actions(market, current_time_ms);
        for (const auto& tr : executed_trades) {
            noise_trader.on_order_matched_or_cancelled(tr.maker_id);
            noise_trader.on_order_matched_or_cancelled(tr.taker_id);
        }
        stats.process_trades(executed_trades, 1, risk, step, current_mid_estimate);

        // 5. Apply any informed adverse price shock to noise trader's central anchor
        if (momentum_trader.has_pending_jump()) {
            double jump = momentum_trader.consume_pending_jump();
            noise_trader.apply_shock(jump);
        }

        // 6. Compute updated features and risk metrics
        auto features = FeatureEngine::calculate(market.get_book());
        double mid_price = safe_json_double(features.mid_price);
        if (mid_price <= 0.0) {
            mid_price = safe_json_double(noise_trader.get_current_price());
        } else {
            noise_trader.update_mid_price(mid_price);
        }
        
        // P&L accounting (Cash includes maker rebates and taker fees)
        double unrealized_pnl = safe_json_double(stats.inventory * mid_price);
        double total_pnl = safe_json_double(stats.cash + unrealized_pnl);
        
        if (total_pnl > stats.max_pnl) stats.max_pnl = total_pnl;
        double drawdown = safe_json_double(stats.max_pnl - total_pnl);
        if (drawdown > stats.max_drawdown) stats.max_drawdown = drawdown;

        // High-Frequency Metrics Calculation (Adverse Selection, Sortino, Half-Life)
        stats.update_hf_metrics(step, mid_price, total_pnl);

        // Phase 3.2: Value-at-Risk 95% & Avellaneda-Stoikov reservation price
        double var_95 = safe_json_double(risk.calculate_var_95(mid_price, features.vol));
        double reservation_price = safe_json_double(risk.calculate_reservation_price(mid_price, features.vol));
        double skew_impact = safe_json_double(risk.calculate_skew_impact(features.vol));
        bool breach = std::abs(stats.inventory) >= max_pos;
        if (breach && !risk.is_killed()) {
            risk.kill_switch();
        }

        if (duration == 0) {
            // Live WebSocket stream format (enclosed in standardized IPC message frame)
            std::cout << "{"
                      << "\"type\": \"TICK\", "
                      << "\"payload\": {"
                      << "\"step\": " << step << ", "
                      << "\"engine_mode\": \"NATIVE_CPP20\", "
                      << "\"market\": {"
                      << "\"mid_price\": " << mid_price << ", "
                      << "\"spread\": " << safe_json_double(features.spread) << ", "
                      << "\"obi\": " << safe_json_double(features.obi) << ", "
                      << "\"volatility\": " << safe_json_double(features.vol)
                      << "}, "
                      << format_order_book(market.get_book()) << ", "
                      << "\"strategy\": {"
                      << "\"name\": \"" << strategy_name << "\", "
                      << "\"regime\": \"" << (features.vol > 0.0005 ? "HIGH_VOL" : "NORMAL") << "\", "
                      << "\"inventory\": " << stats.inventory
                      << "}, "
                      << "\"risk\": {"
                      << "\"status\": \"" << (breach ? "BREACH" : (risk.is_killed() ? "KILLED" : "NORMAL")) << "\", "
                      << "\"exposure\": " << std::abs(stats.inventory) << ", "
                      << "\"max_exposure\": " << max_pos << ", "
                      << "\"inventory\": " << stats.inventory << ", "
                      << "\"inventory_limit\": " << max_pos << ", "
                      << "\"breach\": " << (breach ? "true" : "false") << ", "
                      << "\"var_95\": " << var_95 << ", "
                      << "\"reservation_price\": " << reservation_price << ", "
                      << "\"skew_impact\": " << skew_impact << ", "
                      << "\"gamma\": " << safe_json_double(risk.get_gamma()) << ", "
                      << "\"latency_pending\": " << latency_buffer.pending_actions_count() << ", "
                      << "\"mean_latency_ms\": " << safe_json_double(latency_buffer.get_mean_latency_ms()) << ", "
                      << "\"jitter_stddev_ms\": " << safe_json_double(latency_buffer.get_jitter_stddev_ms()) << ", "
                      << "\"adverse_selection\": " << safe_json_double(stats.adverse_selection) << ", "
                      << "\"sortino_ratio\": " << safe_json_double(stats.sortino_ratio) << ", "
                      << "\"inventory_half_life\": " << safe_json_double(stats.inventory_half_life)
                      << "}, "
                      << "\"performance\": {"
                      << "\"realized_pnl\": " << safe_json_double(stats.cash) << ", "
                      << "\"unrealized_pnl\": " << unrealized_pnl << ", "
                      << "\"total_pnl\": " << total_pnl << ", "
                      << "\"maker_rebates\": " << safe_json_double(stats.total_maker_rebates) << ", "
                      << "\"taker_fees\": " << safe_json_double(stats.total_taker_fees) << ", "
                      << "\"net_fees\": " << safe_json_double(stats.total_maker_rebates - stats.total_taker_fees) << ", "
                      << "\"trades_count\": " << stats.trades_count << ", "
                      << "\"volume_traded\": " << stats.volume_traded << ", "
                      << "\"max_drawdown\": " << safe_json_double(stats.max_drawdown) << ", "
                      << "\"adverse_selection\": " << safe_json_double(stats.adverse_selection) << ", "
                      << "\"sortino_ratio\": " << safe_json_double(stats.sortino_ratio) << ", "
                      << "\"inventory_half_life\": " << safe_json_double(stats.inventory_half_life)
                      << "}"
                      << "}"
                      << "}" << std::endl;
            std::fflush(stdout);
            std::this_thread::sleep_for(std::chrono::milliseconds(20));
        }
    }
    
    if (duration > 0) {
        auto final_features = FeatureEngine::calculate(market.get_book());
        double final_mid = safe_json_double(final_features.mid_price);
        if (final_mid <= 0.0) final_mid = 100.0;
        double final_unrealized = safe_json_double(stats.inventory * final_mid);
        double final_total = safe_json_double(stats.cash + final_unrealized);
        double final_var = safe_json_double(risk.calculate_var_95(final_mid, final_features.vol));

        std::cout << "{\"type\": \"experiment_complete\", \"results\": {"
                  << "\"pnl\": " << final_total << ", "
                  << "\"engine_mode\": \"NATIVE_CPP20\", "
                  << "\"realized_pnl\": " << safe_json_double(stats.cash) << ", "
                  << "\"unrealized_pnl\": " << final_unrealized << ", "
                  << "\"maker_rebates\": " << safe_json_double(stats.total_maker_rebates) << ", "
                  << "\"taker_fees\": " << safe_json_double(stats.total_taker_fees) << ", "
                  << "\"net_fees\": " << safe_json_double(stats.total_maker_rebates - stats.total_taker_fees) << ", "
                  << "\"max_drawdown\": " << safe_json_double(stats.max_drawdown) << ", "
                  << "\"trades_count\": " << stats.trades_count << ", "
                  << "\"volume_traded\": " << stats.volume_traded << ", "
                  << "\"final_inventory\": " << stats.inventory << ", "
                  << "\"var_95\": " << final_var << ", "
                  << "\"adverse_selection\": " << safe_json_double(stats.adverse_selection) << ", "
                  << "\"sortino_ratio\": " << safe_json_double(stats.sortino_ratio) << ", "
                  << "\"inventory_half_life\": " << safe_json_double(stats.inventory_half_life)
                  << "}}" << std::endl;
        std::fflush(stdout);
    }

    g_running = false;
    delete mm_trader;
    return 0;
}
