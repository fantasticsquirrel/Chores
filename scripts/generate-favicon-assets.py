"""Resize the reviewed Codex-generated source; no image API or drawing fallback."""
from pathlib import Path
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/design/family-manager-favicon-source.png'
EXPECTED = '8b19c6882d5f9ba18e6112b403e2eb9b95284bd1c4cbdb9a04c38cc671732c25'


def main():
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED:
        raise RuntimeError('Selected favicon source changed; review and repin deliberately.')
    image = Image.open(SOURCE).convert('RGBA')
    output = ROOT / 'frontend/public'
    output.mkdir(parents=True, exist_ok=True)
    image.save(output / 'favicon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48)])
    for filename, size in [('favicon-32.png',32), ('apple-touch-icon.png',180)]:
        image.resize((size,size), Image.Resampling.LANCZOS).save(output / filename, optimize=True)
    print('Generated favicon.ico (16/32/48), favicon-32.png and apple-touch-icon.png from reviewed source.')


if __name__ == '__main__':
    main()
