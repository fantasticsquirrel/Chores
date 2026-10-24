import atlas from "offline-svg-atlas";
import { validSceneState } from "@family-manager/discovery-scenes/protocol";
const host = document.getElementById("scene");
const send = (message) =>
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
let disposed = false;
const setState = (state) => {
  if (disposed || !validSceneState(state)) return;
  let markup;
  if (state.kind === "optics")
    markup = atlas.optics[`${state.reverse ? 1 : 0}:${state.angle}`];
  else if (state.kind === "pattern")
    markup =
      state.view === "tiles"
        ? atlas.tiles[`${state.sides}:${state.copies}`]
        : atlas.motifs[`${state.rotation}:${state.reflected ? 1 : 0}`];
  else return;
  if (!markup) {
    send({ type: "unavailable" });
    return;
  }
  host.innerHTML = markup;
  host.dataset.surfaceReady = "true";
  send({ type: "rendered" });
};
Object.defineProperty(window, "discoveryScene", {
  value: Object.freeze({ setState }),
});
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    host.replaceChildren();
  },
  { once: true },
);
send({ type: "ready" });
