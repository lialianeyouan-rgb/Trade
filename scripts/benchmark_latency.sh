#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="${1:-${ROOT_DIR}/latency-benchmark.jsonl}"
BUILD_DIR="${TMPDIR:-/tmp}/trade-latency-benchmark"
mkdir -p "$BUILD_DIR"
cd "$ROOT_DIR"

g++ -std=c++20 -O3 -march=native -DNDEBUG \
  -Icpp/orderbook -Icpp/matching -Icpp/simulator \
  cpp/main.cpp cpp/orderbook/order_book.cpp cpp/matching/matching_engine.cpp \
  cpp/simulator/*.cpp -o "$BUILD_DIR/mm_engine"

: > "$OUT_FILE"
for strategy in FixedSpreadMM InventoryAware VolatilityAdaptive RegimeAdaptive; do
  for seed in 1 2 3 42 100; do
    "$BUILD_DIR/mm_engine" --strategy "$strategy" --seed "$seed" --duration 10000 >> "$OUT_FILE"
  done
done

python3 - "$OUT_FILE" <<'PY'
import json
import statistics
import sys
from collections import defaultdict

rows = [json.loads(line) for line in open(sys.argv[1]) if line.strip()]
groups = defaultdict(list)
for row in rows:
    result = row["results"]
    groups[(result.get("strategy", "unknown"), result.get("engine_mode", "unknown"))].append(result)

print(f"benchmark_rows={len(rows)}")
for (strategy, mode), values in sorted(groups.items()):
    means = [v.get("observed_latency_mean_ms", 0) for v in values]
    p99 = [v.get("observed_latency_p99_ms", 0) for v in values]
    pnl = [v.get("pnl", 0) for v in values]
    print(f"strategy={strategy} mode={mode} samples={len(values)} "
          f"latency_mean_ms={statistics.mean(means):.4f} "
          f"latency_p99_ms={max(p99):.1f} pnl_mean={statistics.mean(pnl):.4f}")
PY
