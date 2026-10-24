// Independent package authoring source, copied from the bundled Castle reference.
import * as THREE from "./scene-builder";
function masonryTexture() {
  const canvas = new THREE.TextureCanvas();
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#746d5c";
  context.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row++) {
    for (let col = -1; col < 9; col++) {
      const noise = (row * 73 + col * 43 + 517) % 29;
      const x = col * 64 + (row % 2) * 32;
      context.fillStyle = `rgb(${153 + noise},${146 + noise},${126 + noise})`;
      context.fillRect(x + 1, row * 32 + 1, 61, 29);
      context.fillStyle = "#e0d6bd55";
      context.fillRect(x + 3, row * 32 + 2, 58, 1);
      for (let mark = 0; mark < 18; mark++) {
        context.fillStyle = mark % 2 ? "#453c2922" : "#f9ebd722";
        context.fillRect(
          x + ((mark * 17 + row * 7) % 60),
          row * 32 + ((mark * 11) % 29),
          2,
          1,
        );
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(2, 1.5);
  texture.anisotropy = 4;
  return texture;
}
export function castleMaterials() {
  const texture = masonryTexture();
  const stone = new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: 0.045,
    roughness: 0.93,
    color: 0xd4ccb4,
  });
  const plain = (color: number, roughness = 0.9) =>
    new THREE.MeshStandardMaterial({ color, roughness });
  return {
    stone,
    trim: plain(0xc3baa1),
    darkStone: plain(0x8e8976),
    roof: plain(0x5a6262),
    ridge: plain(0x858a80),
    timber: plain(0x735234),
    iron: plain(0x343b39, 0.65),
    dark: plain(0x2c3027),
    grass: plain(0x64734c),
    bank: plain(0x6f7253),
    earth: plain(0x4c4e3c),
    water: new THREE.MeshStandardMaterial({
      color: 0x407d7b,
      roughness: 0.32,
      metalness: 0.22,
    }),
    paving: plain(0x9b9278),
    path: plain(0xc1ab7e),
    leaves: [plain(0x40583e), plain(0x536846), plain(0x687b4b)],
    sightOverlay: new THREE.LineDashedMaterial({
      color: 0x58e8ee,
      dashSize: 0.8,
      gapSize: 0.6,
      transparent: true,
      opacity: 0.9,
    }),
    gold: new THREE.MeshBasicMaterial({ color: 0xffd37a }),
    ray: new THREE.LineBasicMaterial({
      color: 0xf8d288,
      transparent: true,
      opacity: 0.65,
    }),
    dispose() {
      texture.dispose();
      Object.values(this).forEach((value) => {
        if (value instanceof THREE.Material) value.dispose();
        if (Array.isArray(value))
          value.forEach((material) => material.dispose());
      });
    },
  };
}
export type CastleMaterials = ReturnType<typeof castleMaterials>;
