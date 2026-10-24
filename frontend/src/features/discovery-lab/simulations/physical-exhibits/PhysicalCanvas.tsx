import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createBridgeScene } from "./bridgeScene";
import { createSoundScene } from "./soundScene";
import { createCircuitScene } from "./circuitScene";
import type {
  PhysicalAction,
  PhysicalSceneModel,
  PhysicalSceneState,
} from "./sceneTypes";
export default function PhysicalCanvas({
  state,
  onAction,
  onUnavailable,
}: {
  state: PhysicalSceneState;
  onAction: (action: PhysicalAction) => void;
  onUnavailable: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  latest.current = state;
  const action = useRef(onAction);
  action.current = onAction;
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;
  const engine = useRef<{ model: PhysicalSceneModel; draw: () => void } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "low-power",
      });
    } catch {
      unavailable.current();
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#10212b");
    const model =
      latest.current.kind === "bridge"
        ? createBridgeScene(latest.current)
        : latest.current.kind === "sound"
          ? createSoundScene(latest.current)
          : createCircuitScene(latest.current);
    scene.add(model.group);
    scene.add(new THREE.HemisphereLight("#d7e7ed", "#354338", 2));
    const key = new THREE.DirectionalLight("#fff0d1", 3.2);
    key.position.set(-6, 12, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -13;
    key.shadow.camera.right = 13;
    key.shadow.camera.top = 11;
    key.shadow.camera.bottom = -11;
    key.shadow.normalBias = 0.035;
    key.shadow.bias = -0.00015;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#aac9da", 1.1);
    fill.position.set(7, 5, -8);
    scene.add(fill);
    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
    camera.position.set(...model.view.position);
    camera.lookAt(...model.view.target);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.domElement.setAttribute("aria-hidden", "true");
    element.appendChild(renderer.domElement);
    const annotations = (model.labels?.() || []).map(() => {
      const label = document.createElement("span");
      label.className = "dl-physical-model-label";
      label.setAttribute("aria-hidden", "true");
      element.appendChild(label);
      return label;
    });
    const projected = new THREE.Vector3();
    const placeAnnotations = () => {
      (model.labels?.() || []).forEach((label, index) => {
        projected.set(...label.at).project(camera);
        annotations[index].style.left = `${(projected.x + 1) * 50}%`;
        annotations[index].style.top = `${(1 - projected.y) * 50}%`;
        annotations[index].textContent = label.text;
      });
    };
    let frame = 0;
    let disposed = false;
    const draw = () => {
      if (disposed || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderer.render(scene, camera);
        placeAnnotations();
      });
    };
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const aspect = width / height;
      const worldWidth = Math.max(model.view.width, model.view.height * aspect),
        worldHeight = worldWidth / aspect;
      camera.left = -worldWidth / 2;
      camera.right = worldWidth / 2;
      camera.top = worldHeight / 2;
      camera.bottom = -worldHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      point = new THREE.Vector3();
    const plane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      latest.current.kind === "bridge" ? -1.5 : -1.02,
    );
    let down = false,
      dragName = "";
    const locate = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      raycaster.ray.intersectPlane(plane, point);
      const hits = raycaster.intersectObject(model.group, true);
      return hits.find((hit) => hit.object.name)?.object.name || "";
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragName = locate(event);
      down = true;
      renderer.domElement.setPointerCapture(event.pointerId);
      const result = model.interact(dragName, point, false);
      if (result) action.current(result);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!down || latest.current.kind === "circuit") return;
      locate(event);
      if (
        latest.current.kind === "sound" &&
        dragName !== "length-bridge" &&
        dragName !== "length-ruler"
      )
        return;
      const result = model.interact(dragName, point, true);
      if (result) action.current(result);
    };
    const pointerUp = () => {
      down = false;
    };
    const lost = (event: Event) => {
      event.preventDefault();
      unavailable.current();
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerUp);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    engine.current = { model, draw };
    setReady(true);
    return () => {
      disposed = true;
      engine.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      model.dispose();
      key.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      annotations.forEach((label) => label.remove());
    };
  }, []);
  useEffect(() => {
    engine.current?.model.update(state);
    engine.current?.draw();
  }, [state]);
  return (
    <div
      ref={host}
      className="dl-physical-canvas"
      data-renderer-ready={ready}
    />
  );
}
