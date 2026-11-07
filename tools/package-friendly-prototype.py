#!/usr/bin/env python3
"""Package only runtime assets and stamp offline version from their contents."""
import argparse
import hashlib
from pathlib import Path
import shutil

ASSETS = [
    'index.html', 'app.js', 'app-ui.css', 'icons.js', 'data.js',
    'resources-data.js', 'search.js', 'bridge.js', 'offline.js', 'sw.js',
    'vendor/leaflet.js', 'vendor/leaflet.css', 'NOTICE.txt', 'LICENSE.txt',
]

def package(output: Path) -> str:
    source = Path(__file__).resolve().parents[1] / 'docs/prototypes/friendly-route'
    digest = hashlib.sha256()
    for name in ASSETS:
        digest.update(name.encode())
        digest.update((source / name).read_bytes())
    version = f'friendly-resource-v6-{digest.hexdigest()[:16]}'
    output.mkdir(parents=True, exist_ok=True)
    for name in ASSETS:
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if name in {'sw.js', 'offline.js'}:
            text = (source / name).read_text()
            target.write_text(text.replace('friendly-resource-v6-20261107', version))
        else:
            shutil.copyfile(source / name, target)
    print(f'{output.resolve()} | {version} | {sum((output / name).stat().st_size for name in ASSETS):,} bytes')
    return version

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    package(parser.parse_args().output)
