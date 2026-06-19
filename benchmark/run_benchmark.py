#!/usr/bin/env python3
"""Benchmark the full multi-framework scenario at increasing row counts.

For each size, scale the example tables (rows only) with generate.py, run
inference through the engine's own InferenceSystem, and record one CSV row using
the engine's existing StatsTracker. Results are written incrementally, so a slow
large size does not lose the smaller ones.

Usage:
    uv run python benchmark/run_benchmark.py            # default sizes
    uv run python benchmark/run_benchmark.py 100 1000   # custom sizes (rows/table)

Row count scales the data, not the rule depth, so the round count stays roughly
constant while time and triple count grow with size.
"""
import csv
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate  # noqa: E402

from parajudica.engine import InferenceSystem  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = ROOT / "examples" / "db"
FRAMEWORKS = [
    ROOT / "examples" / "frameworks" / n
    for n in ("base", "hipaa", "gdpr", "ema", "italy")
]
DATA_DIR = HERE / "data"
RESULTS = HERE / "results.csv"

# Rows per table. The full scenario is reasoning-heavy: wall time grows
# superlinearly in rows (k-anonymity + condition evaluation), so ~50 rows/table
# already takes minutes. These sizes show the curve in a sittable time; push
# higher with `make benchmark SIZES="200 400"` if you have the patience.
DEFAULT_SIZES = [10, 25, 50, 100]

COLUMNS = [
    "rows_per_table",
    "rounds",
    "converged",
    "wall_seconds",
    "inference_seconds",
    "final_triples",
    "generated_triples",
]


def run_one(rows: int) -> dict:
    ds = DATA_DIR / f"rows-{rows}"
    generate.generate_dataset(SRC, ds, rows)
    data_files = [str(p) for p in sorted(ds.rglob("*.ttl"))]

    system = InferenceSystem(verbose=0, cache_enabled=False)
    for fw in FRAMEWORKS:
        system.load_framework(str(fw))
    system.load_data(data_files)

    start = time.perf_counter()
    stats = system.run_to_convergence(max_rounds=1000)
    wall = time.perf_counter() - start

    inference_time, generated = system.stats_tracker.get_summary_stats()
    return {
        "rows_per_table": rows,
        "rounds": stats["rounds"],
        "converged": stats["converged"],
        "wall_seconds": round(wall, 2),
        "inference_seconds": round(inference_time, 2),
        "final_triples": system.rule_engine.count_triples(),
        "generated_triples": generated,
    }


def main() -> None:
    sizes = [int(x) for x in sys.argv[1:]] or DEFAULT_SIZES
    with RESULTS.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        for n in sizes:
            print(f"[benchmark] rows/table = {n} ...", flush=True)
            row = run_one(n)
            writer.writerow(row)
            fh.flush()
            print(f"           {row}", flush=True)
    print(f"[benchmark] results -> {RESULTS}")


if __name__ == "__main__":
    main()
