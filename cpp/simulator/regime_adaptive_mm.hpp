#include "market_maker.hpp"
#include "feature_engine.hpp"

class RegimeAdaptiveMM : public MarketMaker {
public:
    RegimeAdaptiveMM(double spread, uint64_t size, uint64_t id_start) 
        : fixed_mm(spread, size, id_start), vol_mm(spread, size, id_start + 1000000) {}

    void update(const Market& market) override;
    std::vector<Order> get_orders() const;

private:
    FixedSpreadMM fixed_mm;
    VolatilityAdaptiveMM vol_mm;
    enum class Regime { CALM, TRENDING, HIGH_VOL, EVENT };
    Regime current_regime = Regime::CALM;
};
