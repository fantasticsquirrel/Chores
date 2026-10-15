import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'frontend', 'public');

function pngSize(name) {
  const bytes = fs.readFileSync(path.join(publicDir, name));
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137,80,78,71,13,10,26,10]));
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test('generated favicon includes real 16, 32 and 48 pixel ICO frames', () => {
  const bytes = fs.readFileSync(path.join(publicDir, 'favicon.ico'));
  assert.equal(bytes.readUInt16LE(0), 0);
  assert.equal(bytes.readUInt16LE(2), 1);
  const count = bytes.readUInt16LE(4);
  assert.ok(count >= 3);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const pos = 6 + i * 16;
    const width = bytes[pos] || 256;
    const height = bytes[pos + 1] || 256;
    assert.equal(width, height);
    const length = bytes.readUInt32LE(pos + 8);
    const offset = bytes.readUInt32LE(pos + 12);
    assert.ok(length > 0 && offset >= 6 + count * 16 && offset + length <= bytes.length);
    sizes.push(width);
  }
  for (const size of [16, 32, 48]) assert.ok(sizes.includes(size));
});

test('PNG favicon and Apple touch icon have their declared real dimensions', () => {
  assert.deepEqual(pngSize('favicon-32.png'), [32,32]);
  assert.deepEqual(pngSize('apple-touch-icon.png'), [180,180]);
});

test('HTML declares subpath-safe favicon and touch links without changing app identity', () => {
  const html = fs.readFileSync(path.join(root, 'frontend/index.html'), 'utf8');
  const version = '4728c853cc71';
  assert.match(html, new RegExp(`<link\\s+rel="icon"\\s+type="image/x-icon"\\s+href="%BASE_URL%favicon\\.ico\\?v=${version}"\\s*/>`));
  assert.match(html, new RegExp(`<link\\s+rel="icon"\\s+type="image/png"\\s+sizes="32x32"\\s+href="%BASE_URL%favicon-32\\.png\\?v=${version}"\\s*/>`));
  assert.match(html, new RegExp(`<link\\s+rel="apple-touch-icon"\\s+sizes="180x180"\\s+href="%BASE_URL%apple-touch-icon\\.png\\?v=${version}"\\s*/>`));
  assert.match(html, /<title>Chore Tracking<\/title>/);
});

test('the selected source is the user-chosen original roof and three-circle artwork', () => {
  const expected = '4728c853cc71fbbc299b993231d5c5b1b1ab455796ed753815af2d908a02eda6';
  const source = fs.readFileSync(path.join(root, 'docs/design/family-manager-favicon-source.png'));
  assert.equal(createHash('sha256').update(source).digest('hex'), expected);
  const generator = fs.readFileSync(path.join(root, 'scripts/generate-favicon-assets.py'), 'utf8');
  assert.ok(generator.includes(`EXPECTED = '${expected}'`));
});

test('edge fallback redirects only root favicon to its same-origin deployed asset', () => {
  const snippet = fs.readFileSync(path.join(root, 'ops/nginx/family-manager-favicon.conf.example'), 'utf8');
  assert.match(snippet, /location\s*=\s*\/favicon\.ico\s*\{\s*return\s+302\s+\/chore\/favicon\.ico;\s*\}/);
  assert.doesNotMatch(snippet, /proxy_pass|https?:|location\s+\/\s*\{/);
});
