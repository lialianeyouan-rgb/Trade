#pragma once
#include <cstdint>

enum class OrderType { LIMIT, MARKET };
enum class Side { BUY, SELL };

struct Order {
    uint64_t id;
    OrderType type;
    Side side;
    double price;
    uint64_t quantity;
    uint64_t timestamp;
};
