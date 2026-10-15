# Family Manager favicon

## Selection

Five distinct raster concepts were created with Codex CLI's native `image_gen__imagegen` tool: house/checkmark, house/door, roof/heart, roof/family dots, and clipboard/checkmark. Native generation and native edit outputs were retained; Codex then flattened the palette and cleaned alpha speckles without redrawing the generated silhouettes.

**Selected: option 2, the cream house with an emerald doorway on a navy rounded tile.** It has the clearest silhouette at 16 pixels and fits the whole household-management app rather than only chores or genealogy. Options 1 and 5 are more task-specific; option 3 emphasizes care; option 4's smaller dots are less distinct at tiny sizes.

`family-manager-favicon-options.png` shows all five final candidates at presentation size and at 16/32/48 pixels on light and dark backgrounds. `family-manager-favicon-source.png` is the exact selected final Codex-generated/cleaned asset, not a hand-drawn replacement.

Selected final source SHA-256:
`8b19c6882d5f9ba18e6112b403e2eb9b95284bd1c4cbdb9a04c38cc671732c25`

Codex native generation identity: `exec-f9f7f041-e1ff-4802-b58b-2913238f85f3`; native edit identity: `exec-c7332f67-fd89-4b9d-aecc-42d405e97cbd`. Final palette/alpha cleanup is included in the source hash above. Full original generations and run evidence are retained privately outside the repository.

## Runtime assets

- `frontend/public/favicon.ico`: actual 16/32/48-pixel ICO frames.
- `frontend/public/favicon-32.png`: 32-pixel browser icon.
- `frontend/public/apple-touch-icon.png`: 180-pixel touch icon.
- `frontend/index.html`: explicit links use Vite `%BASE_URL%`, so `/chore/` production and other configured bases resolve correctly.

Regenerate the runtime assets from the committed selected source with `python scripts/generate-favicon-assets.py` in the backend's existing Pillow-capable environment. It does not regenerate AI artwork or change the selected image.

## Deployment

This is an asset-only change: no database migration, account/data mutation, application feature activation, or branding/title change.

After required review/CI and merge/deployment authorization, build the approved source into a separate staging directory with the production Vite base/API/trusted-origin values. Preserve the current served assets, then replace only the owned static bundle atomically. No backend restart is needed for static favicon files.

Include `ops/nginx/family-manager-favicon.conf.example` inside the existing Family Manager HTTPS server block to redirect legacy/default `/favicon.ico` requests to `/chore/favicon.ico`. Keep existing proxy routes and security headers unchanged. Back up the actual nginx configuration outside included directories, run `nginx -t` before an authorized reload, and verify the root redirect plus final image status/MIME/bytes afterward. Do not copy this standalone location snippet into a top-level `http` context.

Verify the deployed HTML icon links, correct PNG dimensions and ICO frames, `/chore/` icon responses, root redirect, and a fresh browser tab without favicon 404s. Preserve any failed evidence; source implementation is not a claim that production has already changed.
