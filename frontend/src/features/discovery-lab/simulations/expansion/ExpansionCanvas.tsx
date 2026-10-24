import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import type { ExpansionScene } from "@family-manager/discovery-scenes/expansion/types";
import "./expansion.css";
import { placeLabel } from "./labelLayout";
export function ExpansionCanvas<S>({
  state,
  buildScene,
  description,
  onSelect,
  dragSelect = false,
}: {
  state: S;
  buildScene: (state: S) => ExpansionScene<S>;
  description: string;
  onSelect?: (index: number) => void;
  dragSelect?: boolean;
}) {
  const hintId = useId();
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(state);
  latest.current = state;
  const select = useRef(onSelect);
  select.current = onSelect;
  const continuous = useRef(dragSelect);
  continuous.current = dragSelect;
  const engine = useRef<{
    update: (state: S) => void;
    draw: () => void;
  } | null>(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setAvailable(false);
      return;
    }
    let model: ExpansionScene<S>;
    try {
      model = buildScene(latest.current);
    } catch {
      renderer.dispose();
      setAvailable(false);
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#10212b");
    scene.add(model.group, new THREE.HemisphereLight("#dcebf2", "#3d443b", 2));
    const light = new THREE.DirectionalLight("#fff0d4", 3.1);
    light.position.set(-7, 12, 8);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, {
      left: -15,
      right: 15,
      top: 15,
      bottom: -15,
    });
    light.shadow.normalBias = 0.04;
    scene.add(light);
    const fill = new THREE.DirectionalLight("#b4cfee", 1.1);
    fill.position.set(8, 4, -6);
    scene.add(fill);
    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 150);
    const target = new THREE.Vector3(...model.view.target);
    const initial = new THREE.Vector3(...model.view.position).sub(target);
    const spherical = new THREE.Spherical().setFromVector3(initial);
    const resetView = () => {
      spherical.setFromVector3(initial);
      camera.position.copy(initial).add(target);
      camera.lookAt(target);
    };
    resetView();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    element.appendChild(renderer.domElement);
    const labels: HTMLSpanElement[] = [];
    const svgNS = "http://www.w3.org/2000/svg";
    const leaders = document.createElementNS(svgNS, "svg");
    leaders.classList.add("expansion-leaders");
    leaders.setAttribute("aria-hidden", "true");
    element.appendChild(leaders);
    let frame = 0,
      disposed = false;
    const placeLabels = () => {
      const source = model.labels();
      leaders.replaceChildren();
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      const width = element.clientWidth,
        height = element.clientHeight;
      while (labels.length > source.length) labels.pop()?.remove();
      source.forEach((label, index) => {
        if (!labels[index]) {
          const span = document.createElement("span");
          span.className = "expansion-label";
          span.setAttribute("aria-hidden", "true");
          labels.push(span);
          element.appendChild(span);
        }
        const point = new THREE.Vector3(...label.at).project(camera),
          span = labels[index];
        span.textContent = label.text;
        span.hidden = point.z > 1 || point.z < -1;
        const w = span.offsetWidth,
          h = span.offsetHeight;
        const { x, y } = placeLabel(
          {
            x: ((point.x + 1) * width) / 2,
            y: ((1 - point.y) * height) / 2,
            w,
            h,
          },
          placed,
          width,
          height,
        );
        span.style.left = `${x}px`;
        span.style.top = `${y}px`;
        if (!span.hidden) {
          placed.push({ x, y, w, h });
          const ax = ((point.x + 1) * width) / 2,
            ay = ((1 - point.y) * height) / 2;
          if (Math.hypot(ax - x, ay - y) > 14) {
            const line = document.createElementNS(svgNS, "line");
            for (const [key, value] of Object.entries({
              x1: ax,
              y1: ay,
              x2: x,
              y2: y,
            }))
              line.setAttribute(key, String(value));
            const dot = document.createElementNS(svgNS, "circle");
            dot.setAttribute("cx", String(ax));
            dot.setAttribute("cy", String(ay));
            dot.setAttribute("r", "2");
            leaders.append(line, dot);
          }
        }
      });
    };
    const draw = () => {
      if (disposed || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderer.render(scene, camera);
        placeLabels();
      });
    };
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height || disposed) return;
      const aspect = width / height,
        w = Math.max(model.view.width, model.view.height * aspect),
        h = w / aspect;
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    let down: { x: number; y: number; startX: number; startY: number } | null =
      null;
    const rotate = (x: number, y: number) => {
      spherical.theta += x;
      spherical.phi = Math.max(
        0.15,
        Math.min(Math.PI / 2 - 0.02, spherical.phi + y),
      );
      camera.position.setFromSpherical(spherical).add(target);
      camera.lookAt(target);
      draw();
    };
    let manipulating = false;
    const pickAt = (e: PointerEvent) => {
      if (!model.pick || !select.current) return null;
      const box = renderer.domElement.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - box.left) / box.width) * 2 - 1,
          (-(e.clientY - box.top) / box.height) * 2 + 1,
        ),
        camera,
      );
      return model.pick(ray);
    };
    const pointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      };
      renderer.domElement.setPointerCapture(e.pointerId);
      const picked = pickAt(e);
      manipulating = picked !== null;
      if (picked !== null) select.current?.(picked);
    };
    const pointerMove = (e: PointerEvent) => {
      if (!down) return;
      if (manipulating) {
        if (!continuous.current) return;
        const picked = pickAt(e);
        if (picked !== null) select.current?.(picked);
      } else rotate((down.x - e.clientX) * 0.006, (down.y - e.clientY) * 0.004);
      down.x = e.clientX;
      down.y = e.clientY;
    };
    const pointerUp = () => {
      down = null;
      manipulating = false;
    };
    const cancel = () => {
      down = null;
    };
    const keyDown = (e: KeyboardEvent) => {
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-0.12, 0],
        ArrowRight: [0.12, 0],
        ArrowUp: [0, -0.08],
        ArrowDown: [0, 0.08],
      };
      if (moves[e.key]) {
        e.preventDefault();
        rotate(...moves[e.key]);
      }
      if (e.key === "Home") {
        e.preventDefault();
        resetView();
        draw();
      }
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      engine.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", cancel);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      element.removeEventListener("keydown", keyDown);
      model.dispose();
      light.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labels.forEach((label) => label.remove());
      leaders.remove();
    };
    const lost = (e: Event) => {
      e.preventDefault();
      dispose();
      setAvailable(false);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    element.addEventListener("keydown", keyDown);
    engine.current = { update: model.update, draw };
    model.update(latest.current);
    resize();
    return dispose;
  }, [buildScene]);
  useEffect(() => {
    engine.current?.update(state);
    engine.current?.draw();
  }, [state]);
  return (
    <>
      <div
        className="expansion-scene"
        ref={host}
        role="img"
        aria-label={description}
        aria-describedby={available ? hintId : undefined}
        tabIndex={available ? 0 : -1}
      >
        {!available && (
          <p className="expansion-fallback">
            3D rendering is unavailable. Use the controls and results below to
            investigate this concept.
          </p>
        )}
      </div>
      {available && (
        <p className="expansion-view-help" id={hintId}>
          Drag empty space to rotate. Arrow keys rotate; Home resets the view.
        </p>
      )}
    </>
  );
}
