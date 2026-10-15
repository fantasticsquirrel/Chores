# Family Manager favicon

## Selection

Five distinct raster concepts were created with Codex CLI's native `image_gen__imagegen` tool: house/checkmark, house/door, roof/heart, roof/family dots, and clipboard/checkmark. Native generation and native edit outputs were retained; Codex then flattened the palette and cleaned alpha speckles without redrawing the generated silhouettes.

**Selected by the user: option 4, the navy roof over three emerald circles on a cream rounded tile.** This replaces the previously assistant-selected option 2. The uploaded screenshot identifies the artwork; the original lossless candidate is reused rather than cropping/resizing the screenshot's black margins or generating a replacement.

`family-manager-favicon-options.png` shows all five final candidates at presentation size and at 16/32/48 pixels on light and dark backgrounds. `family-manager-favicon-source.png` is the exact selected final Codex-generated/cleaned asset, not a hand-drawn replacement.

Selected final source SHA-256:
`4728c853cc71fbbc299b993231d5c5b1b1ab455796ed753815af2d908a02eda6`

Codex native generation identity: `exec-8b95122b-0d2c-4bdc-b186-7338d1732d06`; native edit identity: `exec-8b03c739-5489-479b-99a7-cec5c3dda6ed`. Final palette/alpha cleanup is included in the source hash above. Full original generations and run evidence are retained privately outside the repository.

## Runtime assets

- `frontend/public/favicon.ico`: actual 16/32/48-pixel ICO frames.
- `frontend/public/favicon-32.png`: 32-pixel browser icon.
- `frontend/public/apple-touch-icon.png`: 180-pixel touch icon.
- `frontend/index.html`: explicit links use Vite `%BASE_URL%`, so `/chore/` production and other configured bases resolve correctly. A source-hash query version (`?v=4728c853cc71`) invalidates the previous icon URLs in browser favicon caches when the selected artwork changes.

Regenerate the runtime assets from the committed selected source with `python scripts/generate-favicon-assets.py` in the backend's existing Pillow-capable environment. It does not regenerate AI artwork or change the selected image.

## Deployment

This is an asset-only change: no database migration, account/data mutation, application feature activation, or branding/title change.

After required review/CI and merge/deployment authorization, build the approved source into a separate staging directory with the production Vite base/API/trusted-origin values. Preserve the current served assets, then replace only the owned static bundle atomically. No backend restart is needed for static favicon files.

Include `ops/nginx/family-manager-favicon.conf.example` inside the existing Family Manager HTTPS server block to redirect legacy/default `/favicon.ico` requests to `/chore/favicon.ico`. Keep existing proxy routes and security headers unchanged. Back up the actual nginx configuration outside included directories, run `nginx -t` before an authorized reload, and verify the root redirect plus final image status/MIME/bytes afterward. Do not copy this standalone location snippet into a top-level `http` context.

Verify the deployed HTML icon links, correct PNG dimensions and ICO frames, `/chore/` icon responses, root redirect, and a fresh browser tab without favicon 404s. Preserve any failed evidence; source implementation is not a claim that production has already changed.
