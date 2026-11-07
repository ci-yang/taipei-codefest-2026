#!/usr/bin/env python3
"""Build the app preview with a smaller, display-only basemap for the report shelf."""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path


def display_coordinates(value: object) -> object:
    """Round background geometry only, at most 0.000005 degrees per axis."""
    if isinstance(value, list):
        return [display_coordinates(item) for item in value]
    if isinstance(value, (int, float)):
        rounded = round(value, 5)
        assert abs(value - rounded) <= 0.0000050001
        return rounded
    return value


def build(output: Path) -> None:
    root = Path(__file__).resolve().parents[1]
    spec = importlib.util.spec_from_file_location(
        "friendly_package", root / "tools/package-friendly-prototype.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.package(output)
    source = root / "docs/prototypes/friendly-route/data.js"
    original = json.loads(source.read_text().split("=", 1)[1].strip().removesuffix(";"))
    features = []
    for feature in original["map"]["features"]:
        features.append({
            "type": "Feature",
            "properties": {
                key: value for key, value in feature["properties"].items()
                if key in {"highway", "leisure", "name"}
            },
            "geometry": {
                "type": feature["geometry"]["type"],
                "coordinates": display_coordinates(feature["geometry"]["coordinates"]),
            },
        })
    basemap = {**original["map"], "features": features}
    lean = {"version": original["version"], "bounds": original["bounds"], "map": basemap}
    (output / "data.js").write_text(
        "window.FRIENDLY_DATA = " + json.dumps(lean, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    # No routing or resource coordinates are reduced. Only unused legacy stores,
    # display feature ids/tags and sub-meter basemap precision are removed.
    for name in ["routing-data.js", "resources-data.js"]:
        assert (output / name).read_bytes() == (source.parent / name).read_bytes()
    total = sum(path.stat().st_size for path in output.rglob("*") if path.is_file())
    if total > 25 * 1024 * 1024:
        raise ValueError(f"Preview exceeds the report shelf 25 MiB budget: {total} bytes")
    print(f"Preview: {total:,} bytes; {len(features):,} display features; full city routing retained")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    build(parser.parse_args().output)
