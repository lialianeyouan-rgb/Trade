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
};

struct Trade {
    uint32_t maker_id;
    uint32_t taker_id;
    Side maker_side;
    double price;
    uint64_t quantity;
    uint64_t timestamp;
};
