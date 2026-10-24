# Procedural tactile artwork

The PNG textures are generated from the complete package-owned `texture-author.ts` drawing functions, copied from the original repository artwork. No third-party images are used. Food speckles and wood grain are deterministic; number and die-pip textures retain the original drawing instructions.

Regenerate from the repository root with `node scripts/exploration-packages/shared/bake-tactile-assets.cjs`. This optional build-time task needs `@napi-rs/canvas`; installed workers use only immutable package PNG assets and never access Canvas or the DOM. Texture repeat, offset and color space are preserved by `tableGeometry.ts`.
