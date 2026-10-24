import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildPizzaScene } from "./pizzaScene";
import { PizzaFallback, ChanceFallback } from "./TableFallback";
import { buildChanceScene } from "./chanceScene";
import {
  disposeGroup,
  material,
  mesh,
  woodTexture,
  type PizzaPlate,
} from "./tableGeometry";

type TableProps =
  | {
      kind: "pizza";
      plates: PizzaPlate[];
      active: number;
      onSlice: (plate: number, slice: number) => void;
    }
  | {
      kind: "chance";
      chances: number[];
      die: boolean;
      last: number | null;
      selected: number;
    };
export function TableCanvas(props: TableProps) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  current.current = props;
  const redraw = useRef<(() => void) | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    // No animation loop: render on a control change, selection, or resize only.
    if (!("WebGLRenderingContext" in window)) {
      setUnavailable(true);
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 40);
    camera.up.set(0, 0, 1);
    scene.add(new THREE.HemisphereLight(0xfff5df, 0x555e5e, 2.2));
    const key = new THREE.DirectionalLight(0xffeccc, 3.8);
    key.position.set(-4, 3, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -6;
    key.shadow.camera.right = key.shadow.camera.top = 6;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.normalBias = 0.018;
    key.shadow.bias = -0.0003;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8e1ee, 1);
    fill.position.set(3, -2, 5);
    scene.add(fill);
    const table = new THREE.Group();
    scene.add(table);
    if (props.kind === "pizza") {
      const wood = woodTexture();
      wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
      wood.repeat.set(3, 2);
      mesh(
        table,
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshStandardMaterial({
          map: wood,
          color: "#c8b08a",
          roughness: 0.85,
        }),
        0,
        0,
        -0.04,
      );
      const cloth = mesh(
        table,
        new THREE.BoxGeometry(3.9, 12, 0.025),
        material("#d7d7c6", 1),
        -4.9,
        0.5,
        -0.015,
      );
      cloth.rotation.z = -0.16;
    } else {
      const shadow = mesh(
        table,
        new THREE.PlaneGeometry(30, 30),
        new THREE.ShadowMaterial({ opacity: 0.24 }),
        0,
        0,
        -0.04,
      );
      shadow.castShadow = false;
    }
    let exhibit = new THREE.Group();
    scene.add(exhibit);
    const raycaster = new THREE.Raycaster();
    const render = () => renderer.render(scene, camera);
    const rebuild = () => {
      const width = container.clientWidth || 700,
        height = container.clientHeight || 500;
      const mobile =
        window.matchMedia("(max-width: 760px)").matches &&
        current.current.kind === "pizza";
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const halfWidth =
        current.current.kind === "pizza" ? (mobile ? 2.5 : 3.8) : 2.5;
      const halfHeight = Math.max(
        halfWidth / aspect,
        current.current.kind === "pizza" && mobile ? 3.4 : 2.35,
      );
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.position.set(0, -5.8, 11);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      scene.remove(exhibit);
      disposeGroup(exhibit);
      const p = current.current;
      exhibit =
        p.kind === "pizza"
          ? buildPizzaScene(p.plates, p.active, mobile)
          : buildChanceScene(p.chances, p.die, p.last, p.selected);
      scene.add(exhibit);
      render();
    };
    let pointerStart: { x: number; y: number } | null = null;
    const beginSelection = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };
    const select = (event: PointerEvent) => {
      const start = pointerStart;
      pointerStart = null;
      if (
        current.current.kind !== "pizza" ||
        !start ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
      )
        return;
      const bounds = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          1 - ((event.clientY - bounds.top) / bounds.height) * 2,
        ),
        camera,
      );
      const hits = raycaster.intersectObjects(exhibit.children, true);
      for (const hit of hits) {
        let target: THREE.Object3D | null = hit.object;
        while (target && target.userData.slice === undefined)
          target = target.parent;
        if (target) {
          current.current.onSlice(target.userData.plate, target.userData.slice);
          break;
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", beginSelection);
    renderer.domElement.addEventListener("pointerup", select);
    const lost = (event: Event) => {
      event.preventDefault();
      setUnavailable(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    const observer = new ResizeObserver(rebuild);
    observer.observe(container);
    redraw.current = rebuild;
    rebuild();
    return () => {
      observer.disconnect();
      redraw.current = null;
      renderer.domElement.removeEventListener("pointerdown", beginSelection);
      renderer.domElement.removeEventListener("pointerup", select);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposeGroup(exhibit);
      disposeGroup(table);
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [props.kind]);
  useEffect(() => {
    redraw.current?.();
  }, [props]);
  return (
    <div
      ref={host}
      className={`tactile-canvas tactile-canvas-${props.kind}`}
      aria-hidden="true"
    >
      {unavailable && (
        <div className="tactile-fallback">
          {props.kind === "pizza" ? (
            <PizzaFallback plates={props.plates} />
          ) : (
            <ChanceFallback
              chances={props.chances}
              last={props.last}
              die={props.die}
            />
          )}
          <p>
            Top-down diagram: 3D rendering is unavailable. All controls still
            work.
          </p>
        </div>
      )}
    </div>
  );
}
