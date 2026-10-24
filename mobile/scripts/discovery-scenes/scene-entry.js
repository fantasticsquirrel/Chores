import { createExpansionScene, isExpansionKind } from "./expansion-scenes";
import { createLandscapeScene } from "@family-manager/discovery-scenes/landscape/createLandscapeScene";
import { createPhysicalScene, createTableScene } from "./model-scenes";
import { validSceneState } from "@family-manager/discovery-scenes/protocol";
import { createMoonScene } from "@family-manager/discovery-scenes/moon";
import { createCastleScene } from "../../../frontend/src/features/discovery-lab/simulations/castle/createCastleScene";
import { createLeafScene } from "../../../frontend/src/features/discovery-lab/simulations/botany/createLeafScene";
import { createSpaceScene } from "../../../frontend/src/features/discovery-lab/simulations/space/createSpaceScene";
import { buildOrbitScene } from "../../../frontend/src/features/discovery-lab/simulations/space/orbitScene";
import { buildSolarScene } from "../../../frontend/src/features/discovery-lab/simulations/space/solarScene";
import { buildGravityScene } from "../../../frontend/src/features/discovery-lab/simulations/space/gravityScene";
import colorUrl from "../../../frontend/src/features/discovery-lab/simulations/moon/assets/lroc-color-2k.jpg";
import heightUrl from "../../../frontend/src/features/discovery-lab/simulations/moon/assets/lola-elevation-1k.jpg";
import earthUrl from "../../../frontend/src/features/discovery-lab/simulations/space/assets/nasa-blue-marble-2k.jpg";

const host = document.getElementById("scene");
const labels = document.getElementById("labels");
const send = (message) =>
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
let replacing = false;
let active = null,
  state = null,
  failed = false,
  disposed = false;
const ready = () => {
  if (failed || disposed) return;
  host.dataset.surfaceReady = "true";
  send({ type: "rendered" });
};
const fail = () => {
  if (failed || disposed) return;
  failed = true;
  send({ type: "unavailable" });
};
const onLabels = (items) => {
  labels.replaceChildren();
  const placed = [],
    width = host.clientWidth,
    height = host.clientHeight;
  for (const item of items.slice(0, 8)) {
    const label = document.createElement("span");
    label.textContent = item.text;
    labels.append(label);
    const w = label.offsetWidth,
      h = label.offsetHeight;
    const x = Math.max(
      4 + w / 2,
      Math.min(width - 4 - w / 2, (item.x * width) / 100),
    );
    let y = Math.max(
      4 + h / 2,
      Math.min(height - 4 - h / 2, (item.y * height) / 100),
    );
    for (let attempt = 0; attempt < 8; attempt++) {
      const collision = placed.find(
        (p) =>
          Math.abs(x - p.x) < (w + p.w) / 2 + 3 &&
          Math.abs(y - p.y) < (h + p.h) / 2 + 3,
      );
      if (!collision) break;
      y = collision.y + (collision.h + h) / 2 + 3;
      if (y > height - 4 - h / 2) y = 4 + h / 2;
    }
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    placed.push({ x, y, w, h });
  }
};

const create = (kind, initial) => {
  if (isExpansionKind(kind))
    return createExpansionScene(host, initial, fail, onLabels);
  if (["river", "pond", "caravan", "garden"].includes(kind)) {
    const scene = createLandscapeScene(host, kind, onLabels, fail);
    return {
      update: scene.setState,
      dispose: scene.dispose,
      orbit: scene.orbit,
    };
  }
  if (["bridge", "sound", "circuit"].includes(kind))
    return createPhysicalScene(host, initial, fail, onLabels);
  if (["pizza", "chance"].includes(kind))
    return createTableScene(host, initial, fail);
  if (kind === "moon") {
    const scene = createMoonScene(host, {
      colorUrl,
      heightUrl,
      onReady: ready,
      onUnavailable: fail,
    });
    return (
      scene && {
        update: (next) => scene.setAngle(next.angle),
        dispose: scene.dispose,
      }
    );
  }
  if (kind === "castle") {
    const scene = createCastleScene(host, onLabels);
    return {
      update: scene.setState,
      dispose: scene.dispose,
      orbit: scene.orbit,
    };
  }
  if (kind === "leaf") {
    const scene = createLeafScene(host, (items) =>
      onLabels(
        items.map((item) => ({
          text: item.text,
          x: item.left ?? item.x,
          y: item.top ?? item.y,
        })),
      ),
    );
    return scene && { update: scene.setState, dispose: scene.dispose };
  }
  if (kind === "orbit")
    return createSpaceScene(
      host,
      (context) => buildOrbitScene(context, earthUrl),
      fail,
    );
  if (kind === "solar") {
    const scene = createSpaceScene(
      host,
      (context) => buildSolarScene(context, earthUrl),
      fail,
    );
    return (
      scene && {
        update: (next) => scene.update({ ...next, planetAngles: next.angles }),
        dispose: scene.dispose,
      }
    );
  }
  const scene = createSpaceScene(host, buildGravityScene, fail);
  return (
    scene && {
      update: (next) =>
        scene.update({
          ...next,
          referenceDistance: next.distances[0],
          comparisonDistance: next.distances[1],
        }),
      dispose: scene.dispose,
    }
  );
};
const setState = (next) => {
  if (
    disposed ||
    failed ||
    !validSceneState(next) ||
    next.kind === "optics" ||
    next.kind === "pattern"
  )
    return;
  try {
    const changed = state?.kind !== next.kind;
    if (changed) {
      replacing = true;
      active?.dispose();
      replacing = false;
      labels.replaceChildren();
      delete host.dataset.surfaceReady;
      active = create(next.kind, next);
      if (!active) {
        fail();
        return;
      }
    }
    state = next;
    active.update(next);
    if (changed && (next.kind === "orbit" || next.kind === "solar")) {
      const surface = new Image();
      surface.src = earthUrl;
      surface
        .decode()
        .then(() => requestAnimationFrame(ready))
        .catch(fail);
    } else if (changed && next.kind !== "moon") requestAnimationFrame(ready);
  } catch {
    fail();
  }
};
Object.defineProperty(window, "discoveryScene", {
  value: Object.freeze({ setState }),
});
// Context loss is reported for every renderer, including builders without a callback.
host.addEventListener(
  "webglcontextlost",
  (event) => {
    event.preventDefault();
    if (!replacing) fail();
  },
  true,
);
let drag = null,
  pending = null,
  frame = null;
const flush = () => {
  frame = null;
  if (!pending || !state) return;
  if (state.kind === "moon") {
    const angle =
      Math.round(
        ((drag.angle + (pending.x - drag.x) * 0.65 + 720) % 360) * 100,
      ) / 100;
    setState({ kind: "moon", angle });
    send({ type: "angle", angle });
  } else if (
    ["castle", "river", "pond", "caravan", "garden"].includes(state.kind)
  ) {
    active?.orbit?.(
      (pending.x - drag.lastX) * 0.006,
      (pending.y - drag.lastY) * 0.004,
    );
    drag.lastX = pending.x;
    drag.lastY = pending.y;
  }
  pending = null;
};
host.addEventListener("pointerdown", (event) => {
  if (
    event.button !== 0 ||
    !state ||
    !["moon", "castle", "river", "pond", "caravan", "garden"].includes(
      state.kind,
    )
  )
    return;
  drag = {
    x: event.clientX,
    lastX: event.clientX,
    y: event.clientY,
    lastY: event.clientY,
    angle: state.angle ?? 0,
  };
  host.setPointerCapture(event.pointerId);
});
host.addEventListener("pointermove", (event) => {
  if (!drag) return;
  pending = { x: event.clientX, y: event.clientY };
  if (frame === null) frame = requestAnimationFrame(flush);
});
const stopDrag = () => {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  if (pending) flush();
  drag = null;
};
host.addEventListener("pointerup", stopDrag);
host.addEventListener("pointercancel", stopDrag);
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    if (frame !== null) cancelAnimationFrame(frame);
    active?.dispose();
  },
  { once: true },
);
send({ type: "ready" });
