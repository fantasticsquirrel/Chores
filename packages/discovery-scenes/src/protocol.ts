import type { OfflineSceneState } from "./protocol-state";
import { number, record, exact } from "./protocol-guards";
import { validSceneState } from "./protocol-validation";
export type {
  OfflineSceneState,
  OfflineSceneKind,
  PizzaPlateState,
} from "./protocol-state";
export { validSceneState } from "./protocol-validation";

export type OfflineSceneMessage =
  | { type: "ready" | "rendered" | "unavailable" }
  | { type: "angle"; angle: number };

export function readSceneMessage(data: string): OfflineSceneMessage | null {
  if (data.length > 128) return null;
  try {
    const message: unknown = JSON.parse(data);
    if (!record(message)) return null;
    if (
      exact(message, ["type"]) &&
      (message.type === "ready" ||
        message.type === "rendered" ||
        message.type === "unavailable")
    )
      return { type: message.type };
    if (
      exact(message, ["type", "angle"]) &&
      message.type === "angle" &&
      number(message.angle, 0, 360)
    )
      return { type: "angle", angle: message.angle };
  } catch {
    /* Ignore malformed messages without logging scene inputs. */
  }
  return null;
}

export function sceneStateScript(state: OfflineSceneState): string | null {
  if (!validSceneState(state)) return null;
  const json = JSON.stringify(state);
  return json.length <= 32768
    ? `window.discoveryScene?.setState(${json}); true;`
    : null;
}
export const isLocalSceneNavigation = (url: string): boolean =>
  url === "about:blank";
