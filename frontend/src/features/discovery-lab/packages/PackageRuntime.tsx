import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DiscoveryPackagePayload } from "@family-manager/family-api/models";
import {
  clearPackageContentCache,
  loadAuthorizedPackage,
  withAuthorizationDeadline,
} from "./packageCache";
import { useDiscoveryRead } from "../hooks/useDiscoveryRead";
import { parseScene, sandboxDocument, type Scene } from "./bridge";

function DiagramViewport({ children }: { children: ReactNode }) {
  const [enlarged, setEnlarged] = useState(false);
  return (
    <div
      className={`discovery-package-diagram${enlarged ? " is-enlarged" : ""}`}
    >
      <button
        type="button"
        aria-pressed={enlarged}
        onClick={() => setEnlarged(!enlarged)}
      >
        {enlarged ? "Fit diagram" : "Enlarge diagram"}
      </button>
      {enlarged && <p>Scroll horizontally to inspect the full diagram.</p>}
      <div
        role="region"
        aria-label="Simulation diagram"
        tabIndex={enlarged ? 0 : undefined}
        style={{ overflowX: "auto", maxWidth: "100%", minWidth: 0 }}
      >
        <div style={{ minWidth: enlarged ? "800px" : 0 }}>{children}</div>
      </div>
    </div>
  );
}

function Drawing({ scene }: { scene: Scene }) {
  return (
    <>
      <DiagramViewport>
        <svg
          viewBox="0 0 800 480"
          role="img"
          aria-label={scene.description}
          className="discovery-package-canvas"
        >
          {scene.shapes.map((p, i) =>
            p.kind === "circle" ? (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={p.fill ?? "#6354b8"}
              />
            ) : p.kind === "rect" ? (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.height}
                fill={p.fill ?? "#6354b8"}
              />
            ) : p.kind === "line" ? (
              <line
                key={i}
                x1={p.x}
                y1={p.y}
                x2={p.x2}
                y2={p.y2}
                stroke={p.stroke ?? "#6354b8"}
                strokeWidth={p.width ?? 2}
              />
            ) : (
              <text
                key={i}
                x={p.x}
                y={p.y}
                fill={p.fill ?? "#27233f"}
                fontSize={p.size ?? 16}
              >
                {p.text}
              </text>
            ),
          )}
        </svg>
      </DiagramViewport>
      <p className="discovery-package-evidence">{scene.description}</p>
    </>
  );
}
function WorkerRuntime({ payload }: { payload: DiscoveryPackagePayload }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [document, setDocument] = useState("");
  const [scene, setScene] = useState<Scene | null>(null);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const values = useRef<Record<string, number>>({});
  const time = useRef(0);
  const ready = useRef(false);
  const cap = useRef(crypto.randomUUID());
  const encoded = payload.assets.find(
    (a) => a.path === payload.manifest.entry,
  )?.content_base64;
  const input = useCallback(
    (type: "step" | "reset" | "control", control?: string) => {
      if (!ready.current) return;
      frame.current?.contentWindow?.postMessage(
        {
          cap: cap.current,
          type: "input",
          data: {
            type,
            time: time.current,
            dt: type === "step" ? 0.05 : 0,
            width: 800,
            height: 480,
            values: values.current,
            ...(control ? { control } : {}),
          },
        },
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
        const parsed = parseScene(e.data.data);
        if (!parsed) {
          ready.current = false;
          setError("The simulation returned an unsupported drawing.");
          return;
        }
        for (const c of parsed.controls)
          if (!Object.prototype.hasOwnProperty.call(values.current, c.id))
            values.current[c.id] = c.value;
        setScene(parsed);
      }
    };
    window.addEventListener("message", onMessage);
    void sandboxDocument(cap.current)
      .then((html) => {
        if (current) setDocument(html);
      })
      .catch(() =>
        setError("This browser cannot start the isolated simulation."),
      );
    return () => {
      current = false;
      ready.current = false;
      window.removeEventListener("message", onMessage);
    };
  }, [encoded, input]);
  useEffect(() => {
    if (paused || error || scene?.animate === false) return;
    const timer = setInterval(() => {
      time.current += 0.05;
      input("step");
    }, 50);
    return () => clearInterval(timer);
  }, [paused, error, input, scene?.animate]);
  if (error) return <p role="alert">{error}</p>;
  return (
    <div className="discovery-package-runtime">
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
      {scene ? <Drawing scene={scene} /> : <p>Starting isolated simulation…</p>}
      <div className="discovery-package-controls">
        {scene?.controls.map((c) => (
          <label key={c.id}>
            {c.label}: {values.current[c.id] ?? c.value}
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={values.current[c.id] ?? c.value}
              onChange={(e) => {
                values.current = {
                  ...values.current,
                  [c.id]: Number(e.target.value),
                };
                input("control", c.id);
                setScene({ ...scene });
              }}
            />
          </label>
        ))}
      </div>
      {scene?.buttons?.map((button) => (
        <button key={button.id} onClick={() => input("control", button.id)}>
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
    </div>
  );
}
function RelationshipRuntime({
  payload,
}: {
  payload: DiscoveryPackagePayload;
}) {
  const model = payload.manifest.scene;
  const control = model?.controls[0];
  const [value, setValue] = useState(control?.initial ?? 1);
  if (!model || !control)
    return <p role="alert">This relationship model is incomplete.</p>;
  const calculate = (x: number) =>
    (model.coefficient ?? 1) * (model.kind === "inverse" ? 1 / x : x) +
    (model.kind === "linear" ? (model.intercept ?? 0) : 0);
  const points = Array.from({ length: 81 }, (_, i) => {
    const x = control.min + ((control.max - control.min) * i) / 80;
    return { x, y: calculate(x) };
  });
  const low = Math.min(0, ...points.map((p) => p.y));
  const high = Math.max(1, ...points.map((p) => p.y));
  const px = (x: number) =>
    80 + (640 * (x - control.min)) / (control.max - control.min);
  const py = (y: number) => 390 - (320 * (y - low)) / (high - low);
  const result = calculate(value);
  const description = `${control.label}: ${value} ${control.unit}. ${model.output.label}: ${result.toFixed(3)} ${model.output.unit}. The line shows the relationship across the allowed input range.`;
  return (
    <div className="discovery-package-runtime">
      <DiagramViewport>
        <svg
          viewBox="0 0 800 480"
          role="img"
          aria-label={description}
          className="discovery-package-canvas"
        >
          <line x1="80" y1="390" x2="740" y2="390" stroke="currentColor" />
          <line x1="80" y1="60" x2="80" y2="390" stroke="currentColor" />
          <polyline
            fill="none"
            stroke="#7860ca"
            strokeWidth="4"
            points={points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}
          />
          <line
            x1={px(value)}
            y1="390"
            x2={px(value)}
            y2={py(result)}
            stroke="#be5674"
            strokeDasharray="5 5"
          />
          <circle cx={px(value)} cy={py(result)} r="9" fill="#be5674" />
          <text x="90" y="35">
            {model.output.label} ({model.output.unit})
          </text>
          <text x="300" y="450">
            {control.label} ({control.unit})
          </text>
          <text x="20" y="75">
            {high.toFixed(1)}
          </text>
          <text x="20" y="390">
            {low.toFixed(1)}
          </text>
          <text x="80" y="420">
            {control.min}
          </text>
          <text x="710" y="420">
            {control.max}
          </text>
        </svg>
      </DiagramViewport>
      <p>{description}</p>
      <label>
        {control.label}: {value} {control.unit}
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
      </label>
      <button onClick={() => setValue(control.initial)}>
        Reset experiment
      </button>
    </div>
  );
}
export function PackagePreview({
  payload,
}: {
  payload: DiscoveryPackagePayload;
}) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    return () => {
      window.removeEventListener("offline", update);
      window.removeEventListener("online", update);
    };
  }, []);
  if (!online)
    return <p role="alert">Reconnect before running this package.</p>;
  return payload.manifest.runtime === "worker-v1" ? (
    <WorkerRuntime key={payload.checksum} payload={payload} />
  ) : (
    <RelationshipRuntime key={payload.checksum} payload={payload} />
  );
}
/** Authorization is never cached offline. Recheck every 15 seconds and on focus. */
export function AuthorizedPackage({
  id,
  identity,
  expectedChecksum,
}: {
  id: string;
  identity: string;
  expectedChecksum?: string;
}) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => () => clearPackageContentCache(), [identity, id]);
  const read = useCallback(
    () => withAuthorizationDeadline(loadAuthorizedPackage(id, identity)),
    [id, identity],
  );
  const state = useDiscoveryRead(`${identity}:${id}`, read, online, true);
  useEffect(() => {
    const off = () => setOnline(false);
    const on = () => setOnline(true);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);
  useEffect(() => {
    if (!online) return;
    const timer = setInterval(state.refresh, 15000);
    return () => clearInterval(timer);
  }, [online, state.refresh]);
  if (!online)
    return (
      <p role="alert">
        Reconnect to verify access before running this package.
      </p>
    );
  if (state.error)
    return (
      <p role="alert">This package is no longer available: {state.error}</p>
    );
  if (!state.data) return <p>Verifying package access…</p>;
  if (expectedChecksum && state.data.checksum !== expectedChecksum)
    return (
      <p role="alert">
        The published version changed. Reopen this Exploration to load its
        matching lesson and simulation.
      </p>
    );
  return <PackagePreview payload={state.data} />;
}
