#include "market.hpp"

std::vector<Trade> Market::process_order(Order& order) {
    auto trades = matching_engine.match(book, order);
    // Only LIMIT orders rest in the book (MARKET orders are IOC/immediate execution)
    if (order.quantity > 0 && order.type == OrderType::LIMIT) {
        book.add_order(order);
    }
    return trades;
}
