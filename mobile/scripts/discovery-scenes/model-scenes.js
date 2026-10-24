import * as THREE from "three";
import { createSpaceScene } from "../../../frontend/src/features/discovery-lab/simulations/space/createSpaceScene";
import { createBridgeScene } from "../../../frontend/src/features/discovery-lab/simulations/physical-exhibits/bridgeScene";
import { createSoundScene } from "../../../frontend/src/features/discovery-lab/simulations/physical-exhibits/soundScene";
import { createCircuitScene } from "../../../frontend/src/features/discovery-lab/simulations/physical-exhibits/circuitScene";
import { buildPizzaScene } from "../../../frontend/src/features/discovery-lab/simulations/tactile/pizzaScene";
import { buildChanceScene } from "../../../frontend/src/features/discovery-lab/simulations/tactile/chanceScene";
import {
  disposeGroup,
  woodTexture,
  mesh,
  material,
} from "../../../frontend/src/features/discovery-lab/simulations/tactile/tableGeometry";

export function createPhysicalScene(host, initial, fail, onLabels) {
  return createSpaceScene(
    host,
    ({ scene, camera, renderer }) => {
      const model =
        initial.kind === "bridge"
          ? createBridgeScene(initial)
          : initial.kind === "sound"
            ? createSoundScene(initial)
            : createCircuitScene(initial);
      scene.background = new THREE.Color("#10212b");
      scene.add(
        model.group,
        new THREE.HemisphereLight("#d7e7ed", "#354338", 2),
      );
      const key = new THREE.DirectionalLight("#fff0d1", 3.2);
      key.position.set(-6, 12, 7);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, {
        left: -13,
        right: 13,
        top: 11,
        bottom: -11,
      });
      key.shadow.normalBias = 0.035;
      key.shadow.bias = -0.00015;
      scene.add(key);
      const fill = new THREE.DirectionalLight("#aac9da", 1.1);
      fill.position.set(7, 5, -8);
      scene.add(fill);
      renderer.toneMappingExposure = 1.04;
      camera.position.set(...model.view.position);
      camera.lookAt(...model.view.target);
      const labels = () => {
        camera.updateMatrixWorld();
        onLabels(
          (model.labels?.() || []).map((label) => {
            const p = new THREE.Vector3(...label.at).project(camera);
            return { text: label.text, x: (p.x + 1) * 50, y: (1 - p.y) * 50 };
          }),
        );
      };
      return {
        update(state) {
          model.update(state);
          labels();
        },
        resize(aspect) {
          const width = Math.max(model.view.width, model.view.height * aspect),
            height = width / aspect;
          Object.assign(camera, {
            left: -width / 2,
            right: width / 2,
            top: height / 2,
            bottom: -height / 2,
          });
          camera.updateProjectionMatrix();
          labels();
        },
        dispose() {
          scene.remove(model.group);
          model.dispose();
          key.shadow.dispose();
        },
      };
    },
    fail,
  );
}

export function createTableScene(host, initial, fail) {
  return createSpaceScene(
    host,
    ({ scene, camera, renderer }) => {
      camera.up.set(0, 0, 1);
      camera.position.set(0, -5.8, 11);
      camera.lookAt(0, 0, 0);
      renderer.toneMappingExposure = 1.3;
      scene.add(new THREE.HemisphereLight(0xfff5df, 0x555e5e, 2.2));
      const key = new THREE.DirectionalLight(0xffeccc, 3.8);
      key.position.set(-4, 3, 8);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, {
        left: -6,
        bottom: -6,
        right: 6,
        top: 6,
        near: 0.5,
        far: 20,
      });
      key.shadow.normalBias = 0.018;
      key.shadow.bias = -0.0003;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xc8e1ee, 1);
      fill.position.set(3, -2, 5);
      scene.add(fill);
      const table = new THREE.Group();
      scene.add(table);
      const wood = woodTexture();
      wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
      wood.repeat.set(3, 2);
      mesh(
        table,
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshStandardMaterial({
          map: wood,
          color: initial.kind === "pizza" ? "#c8b08a" : "#8d785d",
          roughness: 0.85,
        }),
        0,
        0,
        -0.04,
      );
      const cloth = mesh(
        table,
        new THREE.BoxGeometry(3.9, 12, 0.025),
        material(initial.kind === "pizza" ? "#d7d7c6" : "#52635b", 1),
        -4.9,
        0.5,
        -0.015,
      );
      cloth.rotation.z = -0.16;
      let current = initial,
        exhibit = new THREE.Group(),
        aspect = 1;
      scene.add(exhibit);
      const rebuild = () => {
        scene.remove(exhibit);
        disposeGroup(exhibit);
        exhibit =
          current.kind === "pizza"
            ? buildPizzaScene(current.plates, current.active, true)
            : buildChanceScene(
                current.chances,
                current.die,
                current.last,
                current.selected,
              );
        scene.add(exhibit);
        const halfWidth = 2.5,
          halfHeight = Math.max(
            halfWidth / aspect,
            current.kind === "pizza" ? 3.8 : 2.35,
          );
        Object.assign(camera, {
          left: -halfHeight * aspect,
          right: halfHeight * aspect,
          top: halfHeight,
          bottom: -halfHeight,
        });
        camera.updateProjectionMatrix();
      };
      return {
        update(state) {
          current = state;
          rebuild();
        },
        resize(ratio) {
          aspect = ratio;
          rebuild();
        },
        dispose() {
          scene.remove(exhibit, table);
          disposeGroup(exhibit);
          disposeGroup(table);
          key.shadow.dispose();
        },
      };
    },
    fail,
  );
}
