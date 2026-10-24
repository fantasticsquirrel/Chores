import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiscoveryPackagePayload } from "@family-manager/family-api/models";
import { parseScene, sandboxDocument, type Scene } from "./bridge";
import { loadRasterAssets, type RasterAssets } from "./rich/rasterAssets";
import { createTonePlayer } from "./rich/audio";
import { Drawing, type PointerInput } from "./PackageDrawing";
type InputIntent = {
  type: "step" | "reset" | "control" | "pointer" | "resize";
  pointer?: PointerInput;
  control?: string;
  value?: number;
  time: number;
};
function workerInput(
  intent: InputIntent,
  current: Record<string, number>,
  dimensions: { width: number; height: number; viewportWidth: number },
) {
  return {
    type: intent.type,
    ...(intent.pointer ? { pointer: intent.pointer } : {}),
    time: intent.time,
    dt: intent.type === "step" ? 0.05 : 0,
    viewportWidth: dimensions.viewportWidth,
    width: dimensions.width,
    height: dimensions.height,
    values:
      intent.type === "reset"
        ? {}
        : {
            ...current,
            ...(intent.control !== undefined && intent.value !== undefined
              ? { [intent.control]: intent.value }
              : {}),
          },
    ...(intent.control ? { control: intent.control } : {}),
  };
}
export function WorkerRuntime({
  payload: authorizedPayload,
}: {
  payload: DiscoveryPackagePayload;
}) {
  // PackagePreview keys this component by checksum. Fresh authorization responses
  // must not restart the same immutable worker or replace its raster identities.
  const payload = useRef(authorizedPayload).current;
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const dimensions = useRef({ width: 800, height: 480, viewportWidth: 800 });
  const [document, setDocument] = useState("");
  const [assets, setAssets] = useState<RasterAssets>(new Map());
  const assetNames = useMemo(
    () =>
      new Set(
        payload.assets
          .filter((a) => ["image/png", "image/jpeg"].includes(a.mime_type))
          .map((a) => a.path),
      ),
    [payload],
  );
  const [scene, setScene] = useState<Scene | null>(null);
  const previousScene = useRef<Scene | null>(null);
  const [error, setError] = useState("");
  const [audioError, setAudioError] = useState("");
  const tonePlayer = useRef<ReturnType<typeof createTonePlayer> | null>(null);
  useEffect(() => () => tonePlayer.current?.dispose(), []);
  const [paused, setPaused] = useState(false);
  const values = useRef<Record<string, number>>({});
  const time = useRef(0);
  const ready = useRef(false);
  const inFlight = useRef(false);
  const queued = useRef<InputIntent[]>([]);
  const authoritativeValues = useRef<Record<string, number>>({});
  const cap = useRef(crypto.randomUUID());
  const mode =
    String(payload.manifest.runtime) === "worker-rich-v1"
      ? "rich"
      : payload.manifest.runtime === "worker-3d-v1"
        ? "3d"
        : "vector";
  const encoded = payload.assets.find(
    (a) => a.path === payload.manifest.entry,
  )?.content_base64;
  const input = useCallback(
    (
      type: "step" | "reset" | "control" | "pointer" | "resize",
      control?: string,
      value?: number,
      pointer?: PointerInput,
    ) => {
      if (!ready.current) return;
      const intent: InputIntent = {
        type,
        control,
        value,
        pointer,
        time: time.current,
      };
      const data = workerInput(
        intent,
        authoritativeValues.current,
        dimensions.current,
      );
      if (inFlight.current) {
        // Do not grow an animation backlog, but preserve deliberate user actions.
        if (type === "step") return;
        if (
          pointer?.phase === "move" &&
          queued.current.at(-1)?.pointer?.phase === "move"
        ) {
          queued.current[queued.current.length - 1] = intent;
          return;
        }
        if (queued.current.length >= 32) {
          ready.current = false;
          setError(
            "Too many pending changes. Reopen this experiment to continue.",
          );
          return;
        }
        queued.current.push(intent);
        return;
      }
      if (type === "reset") previousScene.current = null;
      inFlight.current = true;
      frame.current?.contentWindow?.postMessage(
        { cap: cap.current, type: "input", data },
        "*",
      );
    },
    [],
  );
  useEffect(() => {
    let current = true;
    if (!encoded) {
      setError("Simulation entry is missing.");
      return;
    }
    let code: string;
    try {
      code = new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
      );
    } catch {
      setError("Simulation source is invalid.");
      return;
    }
    const onMessage = (e: MessageEvent) => {
      if (
        e.source !== frame.current?.contentWindow ||
        e.data?.cap !== cap.current
      )
        return;
      if (e.data.type === "boot")
        frame.current?.contentWindow?.postMessage(
          { cap: cap.current, type: "start", code },
          "*",
        );
      else if (e.data.type === "ready") {
        ready.current = true;
        input("reset");
      } else if (e.data.type === "error") {
        ready.current = false;
        setError(
          "This simulation stopped because its runtime limits were exceeded or its code failed.",
        );
      } else if (e.data.type === "scene") {
        const parsed = parseScene(
          e.data.data,
          mode,
          assetNames,
          previousScene.current,
        );
        if (!parsed) {
          ready.current = false;
          setError("The simulation returned an unsupported drawing.");
          return;
        }
        previousScene.current = parsed;
        inFlight.current = false;
        const next = queued.current.shift();
        authoritativeValues.current = Object.fromEntries(
          parsed.controls.map((c) => [c.id, c.value]),
        );
        if (!next) values.current = authoritativeValues.current;
        setScene(parsed);
        if (next) {
          if (next.type === "reset") previousScene.current = null;
          inFlight.current = true;
          frame.current?.contentWindow?.postMessage(
            {
              cap: cap.current,
              type: "input",
              data: workerInput(
                next,
                authoritativeValues.current,
                dimensions.current,
              ),
            },
            "*",
          );
        }
      }
    };
    window.addEventListener("message", onMessage);
    void Promise.all([
      sandboxDocument(cap.current, mode),
      mode === "rich" ? loadRasterAssets(payload) : Promise.resolve(new Map()),
    ])
      .then(([html, images]) => {
        if (current) {
          setAssets(images);
          setDocument(html);
        }
      })
      .catch(() =>
        setError("This browser cannot start the isolated simulation."),
      );
    return () => {
      current = false;
      ready.current = false;
      inFlight.current = false;
      queued.current = [];
      previousScene.current = null;
      window.removeEventListener("message", onMessage);
    };
  }, [encoded, input, mode, payload, assetNames]);
  const hasScene = scene !== null;
  useEffect(() => {
    if (
      mode !== "rich" ||
      !hasScene ||
      !viewport.current ||
      typeof ResizeObserver === "undefined"
    )
      return;
    const element = viewport.current;
    const measure = () => {
      const target =
        element.querySelector<HTMLElement>(".package-3d-canvas") ??
        element.querySelector<HTMLElement>(".discovery-package-diagram svg") ??
        element;
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const next = {
        viewportWidth: Math.round(
          Math.min(2048, element.getBoundingClientRect().width),
        ),
        width: Math.round(Math.min(2048, rect.width)),
        height: Math.round(Math.min(2048, rect.height)),
      };
      if (
        next.viewportWidth === dimensions.current.viewportWidth &&
        next.width === dimensions.current.width &&
        next.height === dimensions.current.height
      )
        return;
      dimensions.current = next;
      input("resize");
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [mode, hasScene, input]);
  useEffect(() => {
    if (paused || error || scene?.animate === false) return;
    const timer = setInterval(() => {
      if (window.document.hidden || inFlight.current) return;
      time.current += 0.05;
      input("step");
    }, 50);
    return () => clearInterval(timer);
  }, [paused, error, input, scene?.animate]);
  const pressButton = (id: string) => {
    const tone = scene?.audio?.find((t) => t.buttonId === id);
    if (tone) {
      tonePlayer.current ??= createTonePlayer();
      if (!tonePlayer.current.play(tone))
        setAudioError(
          "Audio is unavailable. The visual model remains interactive.",
        );
    }
    input("control", id);
  };
  if (error) return <p role="alert">{error}</p>;
  return (
    <div
      ref={viewport}
      className={`discovery-package-runtime${scene?.scene3d || scene?.rich3d ? " discovery-package-runtime-3d" : ""}`}
    >
      {document && (
        <iframe
          ref={frame}
          title="Isolated simulation engine"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={document}
          style={{ display: "none" }}
        />
      )}
      {scene ? (
        <Drawing
          scene={scene}
          assets={assets}
          onPointer={(event) => input("pointer", undefined, undefined, event)}
        />
      ) : (
        <p>Starting isolated simulation…</p>
      )}
      {audioError && <p role="status">{audioError}</p>}
      <div className="discovery-package-controls">
        {scene?.controls.map((c) => {
          const change = (value: number) => {
            values.current = { ...values.current, [c.id]: value };
            input("control", c.id, value);
            setScene({ ...scene });
          };
          return (
            <label
              key={c.id}
              className={
                c.kind === "toggle"
                  ? "discovery-package-control-toggle"
                  : undefined
              }
            >
              {c.label}
              {c.kind !== "toggle" && c.kind !== "select"
                ? `: ${values.current[c.id] ?? c.value}`
                : ""}
              {c.kind === "toggle" ? (
                <input
                  type="checkbox"
                  aria-label={c.label}
                  checked={(values.current[c.id] ?? c.value) === 1}
                  onChange={(e) => change(e.target.checked ? 1 : 0)}
                />
              ) : c.kind === "select" ? (
                <select
                  aria-label={c.label}
                  value={values.current[c.id] ?? c.value}
                  onChange={(e) => change(Number(e.target.value))}
                >
                  {c.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={values.current[c.id] ?? c.value}
                  onChange={(e) => change(Number(e.target.value))}
                />
              )}
            </label>
          );
        })}
      </div>
      {scene?.buttons
        ?.filter(
          (button) =>
            !scene.sections?.some((section) =>
              section.buttonIds?.includes(button.id),
            ),
        )
        .map((button) => (
          <button
            key={button.id}
            aria-pressed={button.pressed}
            onClick={() => pressButton(button.id)}
          >
            {button.label}
          </button>
        ))}
      {scene?.animate !== false && (
        <button onClick={() => setPaused(!paused)}>
          {paused ? "Resume" : "Pause"}
        </button>
      )}{" "}
      <button
        onClick={() => {
          time.current = 0;
          values.current = {};
          input("reset");
        }}
      >
        Reset experiment
      </button>
      {!!scene?.sections?.length && (
        <div className="discovery-package-sections">
          {scene.sections.map((section, index) => (
            <section key={index}>
              <h3>{section.heading}</h3>
              <p>{section.text}</p>
              {section.buttonIds?.map((id) => {
                const button = scene.buttons?.find((b) => b.id === id);
                return button ? (
                  <button
                    key={id}
                    aria-pressed={button.pressed}
                    onClick={() => pressButton(id)}
                  >
                    {button.label}
                  </button>
                ) : null;
              })}
            </section>
          ))}
        </div>
      )}
      {scene?.footnote && (
        <p className="discovery-package-footnote">{scene.footnote}</p>
      )}
    </div>
  );
}
