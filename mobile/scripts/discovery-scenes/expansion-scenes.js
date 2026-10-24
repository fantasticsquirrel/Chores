import * as THREE from "three";
import { createSpaceScene } from "../../../frontend/src/features/discovery-lab/simulations/space/createSpaceScene";
import { createMachineScene } from "@family-manager/discovery-scenes/expansion/mechanics/machineScene";
import { createHeatScene } from "@family-manager/discovery-scenes/expansion/mechanics/heatScene";
import { createPressureScene } from "@family-manager/discovery-scenes/expansion/mechanics/pressureScene";
import { createMovingPlatesScene } from "@family-manager/discovery-scenes/expansion/earth/plates";
import { createCloudRainScene } from "@family-manager/discovery-scenes/expansion/earth/clouds";
import { createMagneticFieldsScene } from "@family-manager/discovery-scenes/expansion/earth/magnets";
import {
  createCellExplorerScene,
  createShapeSlicerScene,
  createAdaptationIslandScene,
} from "@family-manager/discovery-scenes/expansion/life-geometry/index";

const factories = {
  "machine-workshop": createMachineScene,
  "heat-house": createHeatScene,
  "pressure-tank": createPressureScene,
  "moving-plates": createMovingPlatesScene,
  "cloud-rain-lab": createCloudRainScene,
  "magnetic-fields": createMagneticFieldsScene,
  "cell-explorer": createCellExplorerScene,
  "shape-slicer": createShapeSlicerScene,
  "adaptation-island": createAdaptationIslandScene,
};
export const isExpansionKind = (kind) =>
  Object.prototype.hasOwnProperty.call(factories, kind);

/** Render public deterministic models only; no browser interactions mutate model state. */
export function createExpansionScene(host, initial, fail, onLabels) {
  return createSpaceScene(
    host,
    ({ scene, camera, renderer }) => {
      const model = factories[initial.kind](initial);
      scene.background = new THREE.Color("#10212b");
      scene.add(
        model.group,
        new THREE.HemisphereLight("#e4f1ef", "#45453c", 2),
      );
      const key = new THREE.DirectionalLight("#fff0d1", 3);
      key.position.set(-6, 12, 8);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, {
        left: -14,
        right: 14,
        top: 12,
        bottom: -12,
      });
      key.shadow.normalBias = 0.035;
      key.shadow.bias = -0.00015;
      const fill = new THREE.DirectionalLight("#b4d7ed", 1.2);
      fill.position.set(7, 5, -8);
      scene.add(key, fill);
      renderer.toneMappingExposure = 1.05;
      camera.position.set(...model.view.position);
      camera.lookAt(...model.view.target);
      const labels = () => {
        camera.updateMatrixWorld();
        onLabels(
          model.labels().map((label) => {
            const point = new THREE.Vector3(...label.at).project(camera);
            return {
              text:
                label.text === "Drag thickness ↔"
                  ? "Use insulation control"
                  : label.text,
              x: (point.x + 1) * 50,
              y: (1 - point.y) * 50,
            };
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
