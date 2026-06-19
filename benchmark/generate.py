#!/usr/bin/env python3
"""Scale the example tables by adding random rows (rows only).

Reads the real example data (examples/db), and for each table appends synthetic
records until it reaches a target row count, leaving the schema, scopes, joins,
and frameworks untouched. Files without records (e.g. env.ttl) are copied
verbatim. New record values are sampled from the values already present in each
field, so types and value domains stay valid. Deterministic given --seed.

The point is that the benchmark dataset IS the paper's scenario, just longer.
"""
import argparse
import random
import re
from pathlib import Path

# Prefix-agnostic patterns (data files use ':' or 'sdc:' for the SDC vocabulary).
TABLE_RE = re.compile(r"(\S+)\s+a\s+(?:\w*:)?Table\b")
RECORD_RE = re.compile(r"\ba\s+(?:\w*:)?Record\b")
FIELD_RE = re.compile(
    r"(?:\w*:)?fieldName\s+\"([^\"]+)\"\s*;\s*(?:\w*:)?fieldValue\s+"
    r"(<[^>]+>|\"[^\"]*\"(?:\^\^\S+)?)"
)
SDC_PREFIX_RE = re.compile(r"@prefix\s+(\w*):\s+<[^>]*sdc#>")


def scale_file(text: str, target_rows: int, rng: random.Random) -> str:
    """Return `text` with extra records appended so its table has target_rows.

    No-op (returns text unchanged) for files with no table/records, or when the
    table already has at least target_rows records.
    """
    table = TABLE_RE.search(text)
    fields = FIELD_RE.findall(text)
    if not table or not fields:
        return text

    table_iri = table.group(1)
    sdc = SDC_PREFIX_RE.search(text)
    p = (sdc.group(1) + ":") if sdc else ":"  # prefix for SDC terms in this file

    pools: dict[str, list[str]] = {}
    order: list[str] = []
    for name, value in fields:
        if name not in pools:
            pools[name] = []
            order.append(name)
        pools[name].append(value)

    existing = len(RECORD_RE.findall(text))
    n_add = target_rows - existing
    if n_add <= 0:
        return text

    local = re.sub(r"\W", "_", table_iri.split(":")[-1])
    new_ids = [f"app:bench_{local}_{i}" for i in range(n_add)]
    records = []
    for rid in new_ids:
        cells = ", ".join(
            f'[ {p}fieldName "{name}"; {p}fieldValue {rng.choice(pools[name])} ]'
            for name in order
        )
        records.append(f"{rid} a {p}Record ; {p}hasField {cells} .")

    block = (
        f"\n\n# --- benchmark rows (table scaled to {target_rows}) ---\n"
        f"{table_iri} {p}hasRecords " + ", ".join(new_ids) + " .\n"
        + "\n".join(records)
        + "\n"
    )
    return text + block


def generate_dataset(src: Path, out: Path, target_rows: int, seed: int = 42) -> list[Path]:
    """Write a scaled copy of every .ttl under `src` into `out`. Returns the files."""
    rng = random.Random(seed)
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for f in sorted(src.rglob("*.ttl")):
        dst = out / f.relative_to(src)
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(scale_file(f.read_text(encoding="utf-8"), target_rows, rng))
        written.append(dst)
    return written


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rows", type=int, required=True, help="target rows per table")
    ap.add_argument("--src", default="examples/db", help="source data directory")
    ap.add_argument("--out", required=True, help="output directory for scaled data")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    files = generate_dataset(Path(a.src), Path(a.out), a.rows, a.seed)
    print(f"wrote {len(files)} files scaled to {a.rows} rows/table -> {a.out}")


if __name__ == "__main__":
    main()
