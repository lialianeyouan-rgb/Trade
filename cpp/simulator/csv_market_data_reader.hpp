#pragma once

#include "../orderbook/order.hpp"
#include <string>
#include <vector>
#include <fstream>
#include <sstream>
#include <iostream>
#include <optional>
#include <algorithm>

struct MarketDataEvent {
    uint64_t timestamp = 0;
    std::string event_type; // "ORDER", "CANCEL", "TRADE", "SNAPSHOT"
    Side side = Side::BUY;
    double price = 0.0;
    uint64_t size = 0;
    uint64_t order_id = 0;
};

class CSVMarketDataReader {
public:
    CSVMarketDataReader() = default;
    explicit CSVMarketDataReader(const std::string& filepath) {
        load_csv(filepath);
    }

    bool load_csv(const std::string& filepath) {
        events.clear();
        current_index = 0;

        std::ifstream file(filepath);
        if (!file.is_open()) {
            // Also attempt relative to cwd or /app/applet
            std::string alt_path = filepath;
            if (alt_path.rfind("/cpp/", 0) == 0) {
                alt_path = "." + alt_path;
            } else if (alt_path.rfind("cpp/", 0) == 0) {
                alt_path = "/app/applet/" + alt_path;
            }
            file.open(alt_path);
        }
        if (!file.is_open()) {
            std::cerr << "[CSVMarketDataReader] Warning: Could not open market data file: " << filepath << std::endl;
            return false;
        }

        std::string line;
        bool is_header = true;
        while (std::getline(file, line)) {
            // Trim whitespace / CR
            while (!line.empty() && (line.back() == '\r' || line.back() == ' ' || line.back() == '\t')) {
                line.pop_back();
            }
            if (line.empty()) continue;

            if (is_header) {
                is_header = false;
                // If header contains column names, skip
                if (line.find("timestamp") != std::string::npos || line.find("price") != std::string::npos) {
                    continue;
                }
            }

            // Parse CSV format: timestamp,event_type,side,price,size,order_id
            std::stringstream ss(line);
            std::string item;
            std::vector<std::string> tokens;
            while (std::getline(ss, item, ',')) {
                tokens.push_back(item);
            }

            if (tokens.size() >= 4) {
                MarketDataEvent evt;
                try {
                    evt.timestamp = std::stoull(tokens[0]);
                    evt.event_type = tokens[1];
                    
                    std::string s = tokens[2];
                    std::transform(s.begin(), s.end(), s.begin(), ::toupper);
                    evt.side = (s == "BUY" || s == "B" || s == "1") ? Side::BUY : Side::SELL;
                    
                    evt.price = std::stod(tokens[3]);
                    evt.size = (tokens.size() > 4) ? std::stoull(tokens[4]) : 10;
                    evt.order_id = (tokens.size() > 5) ? std::stoull(tokens[5]) : (1000000 + events.size());

                    events.push_back(evt);
                } catch (...) {
                    // Ignore parse errors on malformed lines
                }
            }
        }

        file.close();
        return !events.empty();
    }

    bool has_next() const {
        return current_index < events.size();
    }

    std::optional<MarketDataEvent> next_event() {
        if (!has_next()) return std::nullopt;
        return events[current_index++];
    }

    void reset() {
        current_index = 0;
    }

    size_t size() const {
        return events.size();
    }

private:
    std::vector<MarketDataEvent> events;
    size_t current_index = 0;
};
