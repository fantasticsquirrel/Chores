// Independent package authoring source, copied from the bundled Castle reference.
import * as THREE from "./scene-builder";
function masonryTexture() {
  const canvas = new THREE.TextureCanvas();
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#665f50";
  context.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row++) {
    for (let col = -1; col < 9; col++) {
      const noise = (row * 73 + col * 43 + 517) % 29;
      const x = col * 64 + (row % 2) * 32;
      context.fillStyle = `rgb(${145 + noise},${137 + noise},${116 + noise})`;
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
    color: 0xc7b890,
  });
  const plain = (color: number, roughness = 0.9) =>
    new THREE.MeshStandardMaterial({ color, roughness });
  return {
    stone,
    trim: plain(0xd1bf96),
    darkStone: plain(0x786d55),
    roof: plain(0x493f3c),
    ridge: plain(0x675b4e),
    timber: plain(0x5c3c25),
    iron: plain(0x20292a, 0.62),
    dark: plain(0x242923),
    grass: plain(0x536943),
    bank: plain(0x5b6848),
    earth: plain(0x3a382b),
    water: new THREE.MeshStandardMaterial({
      color: 0x286573,
      roughness: 0.24,
      metalness: 0.08,
    }),
    paving: plain(0x92866b),
    path: plain(0xb18f5c),
    leaves: [plain(0x314e3b), plain(0x45603e), plain(0x607347)],
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
