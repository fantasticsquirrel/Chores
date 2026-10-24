import * as THREE from "three";
import {
  disk,
  foodTexture,
  material,
  mesh,
  numberTexture,
  sector,
  seeded,
  type PizzaPlate,
} from "./tableGeometry";

function leaf(parent: THREE.Object3D, x: number, y: number, rotation: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.1);
  shape.bezierCurveTo(-0.12, -0.03, -0.1, 0.12, 0, 0.19);
  shape.bezierCurveTo(0.12, 0.1, 0.08, -0.04, 0, -0.1);
  const surface = material("#3e6931", 0.75);
  const result = mesh(
    parent,
    new THREE.ShapeGeometry(shape),
    surface,
    x,
    y,
    0.37,
  );
  result.rotation.z = rotation;
  result.rotation.x = 0.1;
  const vein = mesh(
    result,
    new THREE.CylinderGeometry(0.004, 0.006, 0.22, 5),
    material("#7d994c"),
    0,
    0.035,
    0.003,
  );
  vein.castShadow = false;
}
export function buildPizzaScene(
  plates: PizzaPlate[],
  active: number,
  mobile: boolean,
) {
  const group = new THREE.Group();
  const bread = new THREE.MeshStandardMaterial({
    color: "#d19a4b",
    roughness: 0.88,
    map: foodTexture("#e9b66b", "#74401b", 160),
  });
  const cheese = new THREE.MeshStandardMaterial({
    color: "#ffda7b",
    roughness: 0.64,
    map: foodTexture("#ffe6a0", "#ad5f26", 100),
  });
  const sauce = material("#9d3923", 0.66);
  const pepperoni = new THREE.MeshStandardMaterial({
    color: "#b84327",
    roughness: 0.6,
    map: foodTexture("#b9482c", "#f4bc80", 200),
  });
  const olive = material("#28372a", 0.35);
  group.userData.ownedMaterials = [bread, cheese, sauce, pepperoni, olive];
  plates.forEach((plate, p) => {
    const base = new THREE.Group();
    base.position.set(
      mobile ? 0 : p === 0 ? -1.82 : 1.82,
      mobile ? (p === 0 ? 2.2 : -2.2) : 0,
      0,
    );
    group.add(base);
    const ceramic = material(p === 0 ? "#f4eddb" : "#d5e1db", 0.23);
    disk(base, 1.62, 0.09, ceramic, 0, 0, 0.04);
    disk(
      base,
      1.48,
      0.035,
      material(p === 0 ? "#e9dfc7" : "#b8d0c7", 0.22),
      0,
      0,
      0.1,
    );
    mesh(
      base,
      new THREE.TorusGeometry(1.53, 0.025, 10, 100),
      material(active === p ? "#ba893b" : "#6e8e87", 0.3, 0.4),
      0,
      0,
      0.12,
    );
    mesh(
      base,
      new THREE.TorusGeometry(1.38, 0.009, 6, 100),
      material("#b5afa0", 0.6),
      0,
      0,
      0.12,
    );
    for (let i = 0; i < plate.d; i++) {
      const span = (Math.PI * 2) / plate.d,
        start = Math.PI / 2 - (i + 1) * span;
      const mid = start + span / 2;
      const pick = mesh(
        base,
        sector(1.32, start, span, 0.015),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
        0,
        0,
        0.16,
      );
      pick.userData = { plate: p, slice: i };
      pick.castShadow = pick.receiveShadow = false;
      const number = mesh(
        base,
        new THREE.PlaneGeometry(0.16, 0.16),
        new THREE.MeshBasicMaterial({
          map: numberTexture(i + 1, "#685d4a"),
          transparent: true,
          depthWrite: false,
        }),
        Math.cos(mid) * 1.45,
        Math.sin(mid) * 1.45,
        0.14,
      );
      number.rotation.z = 0;
      number.castShadow = number.receiveShadow = false;
      if (!plate.slices.includes(i)) {
        const outline = new THREE.LineSegments(
          new THREE.EdgesGeometry(sector(1.29, start, span, 0)),
          new THREE.LineBasicMaterial({
            color: "#a49f8d",
            transparent: true,
            opacity: 0.38,
          }),
        );
        outline.position.z = 0.13;
        base.add(outline);
        continue;
      }
      const piece = new THREE.Group();
      piece.position.set(Math.cos(mid) * 0.016, Math.sin(mid) * 0.016, 0);
      piece.userData = { plate: p, slice: i };
      base.add(piece);
      mesh(
        piece,
        sector(1.28, start + 0.003, span - 0.006, 0.13),
        bread,
        0,
        0,
        0.13,
      );
      mesh(
        piece,
        sector(1.19, start + 0.006, span - 0.012, 0.028),
        sauce,
        0,
        0,
        0.262,
      );
      mesh(
        piece,
        sector(1.17, start + 0.008, span - 0.016, 0.045),
        cheese,
        0,
        0,
        0.29,
      );
      const crust = mesh(
        piece,
        new THREE.TorusGeometry(
          1.22,
          0.105,
          12,
          Math.max(12, Math.ceil(72 / plate.d)),
          span - 0.012,
        ),
        bread,
        0,
        0,
        0.29,
      );
      crust.rotation.z = start + 0.006;
      crust.scale.z = 0.75;
      // Ingredients are fixed on the whole, then assigned to their exact slice.
      for (let topping = 0; topping < 25; topping++) {
        const angle = (topping * 2.399963229728653 + 0.25) % (Math.PI * 2),
          radius = 0.28 + seeded(topping + 9) * 0.7;
        let relative = (angle - start) % (Math.PI * 2);
        if (relative < 0) relative += Math.PI * 2;
        // Keep toppings inside the wedge, so no food crosses a counted boundary.
        const margin = Math.min(relative, span - relative);
        const toppingRadius = Math.min(
          0.125,
          Math.max(0, radius * Math.sin(Math.min(margin, Math.PI / 2)) - 0.018),
        );
        if (relative > span || toppingRadius < 0.04) continue;
        const x = Math.cos(angle) * radius,
          y = Math.sin(angle) * radius;
        if (topping % 5 === 0 && toppingRadius > 0.09) leaf(piece, x, y, angle);
        else if (topping % 4 === 0) {
          mesh(
            piece,
            new THREE.TorusGeometry(toppingRadius * 0.65, 0.024, 8, 18),
            olive,
            x,
            y,
            0.36,
          );
        } else {
          disk(piece, toppingRadius, 0.026, pepperoni, x, y, 0.35);
          mesh(
            piece,
            new THREE.TorusGeometry(toppingRadius * 0.96, 0.008, 5, 24),
            material("#8d2f1e", 0.8),
            x,
            y,
            0.365,
          );
        }
      }
    }
  });
  return group;
}
