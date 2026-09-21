#pragma once
#include <cstdint>

enum class OrderType { LIMIT, MARKET };
enum class Side { BUY, SELL };

struct Order {
    uint64_t id;
    uint32_t trader_id;
    OrderType type;
    Side side;
    double price;
    uint64_t quantity;
    uint64_t timestamp;
    uint64_t queue_ahead = 0; // Volume ahead of this order in FIFO queue at arrival
};

struct Trade {
    uint32_t maker_id;
    uint32_t taker_id;
    Side maker_side;
    double price;
    uint64_t quantity;
    uint64_t timestamp;
    double maker_rebate = 0.0; // Maker fee rebate (+0.01% / +1 bps)
    double taker_fee = 0.0;    // Taker fee (-0.02% / -2 bps)
};
