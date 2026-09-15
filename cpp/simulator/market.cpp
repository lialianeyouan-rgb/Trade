#include "market.hpp"

void Market::process_order(Order& order) {
    matching_engine.match(book, order);
    if (order.quantity > 0) {
        book.add_order(order);
    }
}
