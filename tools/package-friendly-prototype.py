#!/usr/bin/env python3
"""Package only runtime assets and stamp offline version from their contents."""
from __future__ import annotations

import argparse
import hashlib
import re
import shutil
from pathlib import Path

ASSETS = (
    "index.html",
    "app.js",
    "app-ui.css",
    "highlights.css",
    "highlights.js",
    "highlight-math.js",
    "urgency.js",
    "i18n.js",
    "speak-card-strings.js",
    "speak-card.js",
    "speak-card.css",
    "price-data.js",
    "icons.js",
    "data.js",
    "resources-data.js",
    "search.js",
    "route-client.js",
    "routing-worker.js",
    "routing.js",
    "routing-data.js",
    "bridge.js",
    "offline.js",
    "sw.js",
    "vendor/leaflet.js",
    "vendor/leaflet.css",
    "vendor/LICENSE-leaflet.txt",
    "NOTICE.txt",
    "LICENSE.txt",
)


def package(output: Path, build_sha: str | None = None) -> str:
    if build_sha is not None and re.fullmatch(r"[a-f0-9]{40}", build_sha) is None:
        raise ValueError("build_sha must be a complete lowercase commit SHA")
    source = Path(__file__).resolve().parents[1] / "docs/prototypes/friendly-route"
    digest = hashlib.sha256()
    if build_sha is not None:
        digest.update(f"build-sha:{build_sha}\n".encode())
    for name in ASSETS:
        digest.update(name.encode())
        digest.update((source / name).read_bytes())
    version = f"friendly-resource-v6-{digest.hexdigest()[:16]}"
    output.mkdir(parents=True, exist_ok=True)
    for name in ASSETS:
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if name in {"sw.js", "offline.js"}:
            text = (source / name).read_text()
            target.write_text(text.replace("friendly-resource-v6-20261107", version))
        elif name == "index.html" and build_sha is not None:
            text = (source / name).read_text()
            if text.count("</head>") != 1:
                raise ValueError("App index must contain exactly one closing head tag")
            meta = f'  <meta name="app-build-sha" content="{build_sha}">\n'
            target.write_text(text.replace("</head>", f"{meta}</head>"))
        else:
            shutil.copyfile(source / name, target)
    size = sum((output / name).stat().st_size for name in ASSETS)
    print(f"{output.resolve()} | {version} | {size:,} bytes")
    return version


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--build-sha")
    args = parser.parse_args()
    package(args.output, args.build_sha)
