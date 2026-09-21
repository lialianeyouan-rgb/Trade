cmake_minimum_required(VERSION 3.16)
project(mm_engine CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(orderbook matching simulator)

set(SOURCES
    main.cpp
    orderbook/order_book.cpp
    matching/matching_engine.cpp
    simulator/market.cpp
    simulator/noise_trader.cpp
    simulator/fixed_spread_mm.cpp
    simulator/risk_engine.cpp
    simulator/feature_engine.cpp
    simulator/inventory_aware_mm.cpp
    simulator/volatility_adaptive_mm.cpp
    simulator/order_flow_aware_mm.cpp
    simulator/regime_adaptive_mm.cpp
    simulator/momentum_trader.cpp
)

add_executable(mm_engine ${SOURCES})

set_target_properties(mm_engine PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_CURRENT_SOURCE_DIR}"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_CURRENT_SOURCE_DIR}"
)

