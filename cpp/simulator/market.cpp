#include "market.hpp"

std::vector<Trade> Market::process_order(Order& order) {
    auto trades = matching_engine.match(book, order);
    if (order.quantity > 0) {
        book.add_order(order);
    }
    return trades;
}
