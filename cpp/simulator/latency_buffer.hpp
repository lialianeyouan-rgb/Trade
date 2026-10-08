#pragma once
#include "../orderbook/order.hpp"
#include "market.hpp"
#include "risk_engine.hpp"
#include <array>
#include <queue>
#include <vector>
#include <random>
#include <cmath>
#include <algorithm>
#include <cstdint>

enum class GatewayActionType { SUBMIT_ORDER, CANCEL_ORDER, CANCEL_TRADER_ORDERS };

struct GatewayAction {
    uint64_t arrival_time;
    uint64_t submitted_time;
    uint64_t sequence;
    uint64_t sampled_delay_ms;
    GatewayActionType type;
    Order order;
    uint64_t cancel_order_id;
    uint32_t trader_id;

    bool operator>(const GatewayAction& other) const {
        if (arrival_time != other.arrival_time) return arrival_time > other.arrival_time;
        return sequence > other.sequence;
    }
};

struct LatencyMetrics {
    uint64_t samples = 0;
    uint64_t effective_sum_ms = 0;
    uint64_t requested_sum_ms = 0;
    uint64_t queue_wait_sum_ms = 0;
    uint64_t min_ms = 0;
    uint64_t max_ms = 0;
    uint64_t requested_min_ms = 0;
    uint64_t requested_max_ms = 0;
    size_t max_pending = 0;
    // Effective latency upper-bound buckets: 0, 1, 2, 5, 10, 20, 50, and >50 ms.
    std::array<uint64_t, 8> buckets{};

    void observe(uint64_t effective_ms, uint64_t requested_ms) {
        if (samples == 0) {
            min_ms = effective_ms;
            requested_min_ms = requested_ms;
        }
        min_ms = std::min(min_ms, effective_ms);
        max_ms = std::max(max_ms, effective_ms);
        requested_min_ms = std::min(requested_min_ms, requested_ms);
        requested_max_ms = std::max(requested_max_ms, requested_ms);
        effective_sum_ms += effective_ms;
        requested_sum_ms += requested_ms;
        queue_wait_sum_ms += effective_ms >= requested_ms ? effective_ms - requested_ms : 0;
        ++samples;

        static constexpr uint64_t bounds[] = {0, 1, 2, 5, 10, 20, 50};
        size_t bucket = 7;
        for (size_t i = 0; i < 7; ++i) {
            if (effective_ms <= bounds[i]) { bucket = i; break; }
        }
        ++buckets[bucket];
    }

    double mean_ms() const {
        return samples == 0 ? 0.0 : static_cast<double>(effective_sum_ms) / samples;
    }
    double requested_mean_ms() const {
        return samples == 0 ? 0.0 : static_cast<double>(requested_sum_ms) / samples;
    }
    double queue_wait_mean_ms() const {
        return samples == 0 ? 0.0 : static_cast<double>(queue_wait_sum_ms) / samples;
    }
    uint64_t percentile(double p) const {
        if (samples == 0) return 0;
        const uint64_t target = std::max<uint64_t>(1, static_cast<uint64_t>(std::ceil(p * samples)));
        uint64_t cumulative = 0;
        static constexpr uint64_t representatives[] = {0, 1, 2, 5, 10, 20, 50, 51};
        for (size_t i = 0; i < buckets.size(); ++i) {
            cumulative += buckets[i];
            if (cumulative >= target) return representatives[i];
        }
        return max_ms;
    }
};

/** Measures requested gateway delay, effective discrete delay, and queue wait. */
class LatencyBuffer {
public:
    LatencyBuffer(double mean_latency_ms = 5.0, double jitter_stddev_ms = 2.0, uint64_t seed = 42)
        : mean_ms(mean_latency_ms), stddev_ms(jitter_stddev_ms), rng(seed), lat_dist(mean_latency_ms, jitter_stddev_ms) {}

    void submit_order(const Order& order, uint64_t current_time) {
        enqueue(make_action(order, current_time, GatewayActionType::SUBMIT_ORDER, 0, order.trader_id));
    }
    void cancel_order(uint64_t order_id, uint32_t trader_id, uint64_t current_time) {
        enqueue(make_action(Order{}, current_time, GatewayActionType::CANCEL_ORDER, order_id, trader_id));
    }
    void cancel_trader_orders(uint32_t trader_id, uint64_t current_time) {
        enqueue(make_action(Order{}, current_time, GatewayActionType::CANCEL_TRADER_ORDERS, 0, trader_id));
    }

    void clear_trader(uint32_t trader_id) {
        std::vector<GatewayAction> retained;
        while (!queue.empty()) {
            GatewayAction action = queue.top();
            queue.pop();
            const bool belongs =
                (action.type == GatewayActionType::SUBMIT_ORDER && action.order.trader_id == trader_id) ||
                (action.type == GatewayActionType::CANCEL_TRADER_ORDERS && action.trader_id == trader_id) ||
                (action.type == GatewayActionType::CANCEL_ORDER && action.trader_id == trader_id);
            if (!belongs) retained.push_back(action);
        }
        for (const auto& action : retained) queue.push(action);
    }

    std::vector<Trade> drain_due_actions(Market& market, RiskEngine& risk, uint64_t current_time) {
        std::vector<Trade> all_trades;
        while (!queue.empty() && queue.top().arrival_time <= current_time) {
            GatewayAction action = queue.top();
            queue.pop();
            const uint64_t effective = current_time >= action.submitted_time ? current_time - action.submitted_time : 0;
            metrics.observe(effective, action.sampled_delay_ms);
            switch (action.type) {
                case GatewayActionType::SUBMIT_ORDER: {
                    risk.remove_pending_order(action.order);
                    auto trades = market.process_order(action.order);
                    all_trades.insert(all_trades.end(), trades.begin(), trades.end());
                    break;
                }
                case GatewayActionType::CANCEL_ORDER:
                    market.cancel_order(action.cancel_order_id);
                    break;
                case GatewayActionType::CANCEL_TRADER_ORDERS:
                    market.cancel_orders_by_trader(action.trader_id);
                    break;
            }
        }
        return all_trades;
    }

    size_t pending_actions_count() const { return queue.size(); }
    double get_mean_latency_ms() const { return mean_ms; }
    double get_jitter_stddev_ms() const { return stddev_ms; }
    const LatencyMetrics& get_metrics() const { return metrics; }

private:
    double mean_ms;
    double stddev_ms;
    std::mt19937_64 rng;
    std::normal_distribution<double> lat_dist;
    uint64_t next_sequence = 0;
    LatencyMetrics metrics;
    std::priority_queue<GatewayAction, std::vector<GatewayAction>, std::greater<GatewayAction>> queue;

    uint64_t sampled_delay() { return static_cast<uint64_t>(std::round(std::max(1.0, lat_dist(rng)))); }
    GatewayAction make_action(const Order& order, uint64_t current_time, GatewayActionType type,
                              uint64_t cancel_order_id, uint32_t trader_id) {
        const uint64_t delay = sampled_delay();
        return {current_time + delay, current_time, next_sequence++, delay, type,
                order, cancel_order_id, trader_id};
    }
    void enqueue(const GatewayAction& action) {
        queue.push(action);
        metrics.max_pending = std::max(metrics.max_pending, queue.size());
    }
};
