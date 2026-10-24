/** Author-side lesson state machine. All callbacks are bundled into the isolated worker. */
import { Raycaster, Vector3 } from "three";
import { serializeExpansionScene } from "./shared/serialize-scene";
import { createFrameCompactor } from "./shared/compact-frame";
export type Trial<S> = {
  title: string;
  question: string;
  choices: string[];
  controlled: string;
  before: S;
  after: S;
  change: string;
  evidence?: string;
  explain: string;
};
export type Field = {
  id: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
  labels?: readonly string[];
  toggle?: boolean;
};
export type Lesson<S> = {
  initial: S;
  build: (state: S) => any;
  fields: Field[];
  title: string;
  introduction: string;
  note: string;
  trials: Trial<S>[];
  describe: (state: S) => string;
  normalize?: (state: S) => S;
  change?: (state: S, key: string, value: any) => S;
  actions?: { id: string; label: string; run: (state: S) => S }[];
  select?: (state: S, value: number) => S;
  shapes?: (state: S) => any[];
  vector?: (state: S) => any;
  drag?: boolean;
  serialize?: (scene: any, presentation: any) => any;
};
export function installLesson<S extends Record<string, any>>(
  lesson: Lesson<S>,
) {
  let state = structuredClone(lesson.initial),
    trial = 0,
    prediction: number | null = null,
    stage = 0,
    dragCapture = true;
  const apply = (next: S) => {
    state = lesson.normalize
      ? lesson.normalize(structuredClone(next))
      : structuredClone(next);
  };
  function run(input: any) {
    const action = input.control;
    if (input.type === "reset") {
      apply(lesson.initial);
      trial = 0;
      prediction = null;
      stage = 0;
      dragCapture = true;
    }
    if (input.type === "control") {
      const f = lesson.fields.find((f) => f.id === action),
        raw = input.values?.[action];
      if (f && Number.isFinite(raw)) {
        stage = 0;
        const value = f.options
          ? f.options[
              Math.max(0, Math.min(f.options.length - 1, Math.round(raw)))
            ]
          : f.toggle
            ? raw === 1
            : Math.max(f.min ?? 0, Math.min(f.max ?? 100, raw));
        apply(
          lesson.change
            ? lesson.change(state, action, value)
            : { ...state, [action]: value },
        );
      }
    }
    if (action?.startsWith("trial_")) {
      trial = Math.max(
        0,
        Math.min(lesson.trials.length - 1, Number(action.slice(6)) || 0),
      );
      prediction = null;
      stage = 0;
    }
    if (action?.startsWith("predict_")) {
      const n = Number(action.slice(8));
      if (
        Number.isInteger(n) &&
        n >= 0 &&
        n < lesson.trials[trial].choices.length
      ) {
        prediction = n;
        stage = 0;
      }
    }
    const t = lesson.trials[trial];
    if (action === "baseline" && prediction !== null) {
      apply(t.before);
      stage = 1;
    }
    if (action === "comparison" && stage === 1) {
      apply(t.after);
      stage = 2;
    }
    const custom = lesson.actions?.find((a) => a.id === action);
    if (custom) {
      stage = 0;
      apply(custom.run(state));
    }
    let scene = lesson.build(state);
    if (
      input.type === "pointer" &&
      lesson.select &&
      (lesson.drag || input.pointer?.phase === "up")
    ) {
      const pointer = input.pointer ?? input;
      let picked: number | null = null;
      if (
        Array.isArray(pointer.rayOrigin) &&
        Array.isArray(pointer.rayDirection) &&
        pointer.rayOrigin.length === 3 &&
        pointer.rayDirection.length === 3 &&
        [...pointer.rayOrigin, ...pointer.rayDirection].every(Number.isFinite)
      ) {
        scene.group.updateMatrixWorld(true);
        picked =
          scene.pick?.(
            new Raycaster(
              new Vector3(...pointer.rayOrigin),
              new Vector3(...pointer.rayDirection).normalize(),
            ),
          ) ?? null;
      } else if (
        typeof pointer.nodeId === "string" &&
        /^select_-?\d+$/.test(pointer.nodeId)
      )
        picked = Number(pointer.nodeId.slice(7));
      if (lesson.drag && pointer.phase === "down")
        dragCapture = picked !== null;
      if (picked !== null && (!lesson.drag || dragCapture)) {
        stage = 0;
        scene.dispose();
        apply(lesson.select(state, picked));
        scene = lesson.build(state);
      }
      if (lesson.drag && pointer.phase === "up") dragCapture = true;
    }
    const scene3d = (lesson.serialize ?? serializeExpansionScene)(scene, {
      title: lesson.title,
      subtitle: lesson.introduction,
      background: ["#10212b", "#10212b", "#10212b"],
    });
    scene.dispose();
    return {
      animate: false,
      description: lesson.describe(state),
      scene3d,
      shapes: lesson.shapes?.(state) ?? [],
      ...(lesson.vector ? { vector: lesson.vector(state) } : {}),
      ...(lesson.select
        ? {
            pointer: true,
            pointerMode: lesson.drag && dragCapture ? "drag" : "tap",
          }
        : {}),
      controls: lesson.fields.map((f) => ({
        id: f.id,
        label: f.label,
        min: f.options || f.toggle ? 0 : (f.min ?? 0),
        max: f.options ? f.options.length - 1 : f.toggle ? 1 : (f.max ?? 100),
        step: f.step ?? 1,
        value: f.options
          ? Math.max(0, f.options.indexOf(state[f.id]))
          : f.toggle
            ? state[f.id]
              ? 1
              : 0
            : state[f.id],
        ...(f.options
          ? {
              kind: "select",
              options: f.options.map((v, i) => ({
                value: i,
                label: f.labels?.[i] ?? v,
              })),
            }
          : f.toggle
            ? { kind: "toggle" }
            : {}),
      })),
      buttons: [
        ...lesson.trials.map((t, i) => ({
          id: `trial_${i}`,
          label: t.title,
          pressed: i === trial,
        })),
        ...t.choices.map((label, i) => ({
          id: `predict_${i}`,
          label,
          pressed: i === prediction,
        })),
        { id: "baseline", label: "Set baseline" },
        { id: "comparison", label: t.change },
        ...(lesson.actions ?? []).map(({ id, label }) => ({ id, label })),
      ],
      sections: [
        {
          heading: "1. Predict",
          text:
            t.question +
            (prediction === null
              ? " Choose a prediction before setting the comparison."
              : ` Your prediction: ${t.choices[prediction]}.`),
          buttonIds: t.choices.map((_, i) => `predict_${i}`),
        },
        {
          heading: "2. Compare",
          text:
            t.controlled +
            (stage === 1
              ? " Baseline is set. Read its measurements, then apply the change."
              : ""),
          buttonIds: ["baseline", "comparison"],
        },
        {
          heading: "3. Explain",
          text:
            stage === 2
              ? `${t.evidence ?? lesson.describe(state)} ${t.explain}`
              : "After comparing, use the two sets of evidence to explain what changed and what stayed fixed.",
        },
      ],
      footnote: lesson.note,
    };
  }
  const compact = createFrameCompactor();
  (globalThis as any).onmessage = ({ data }: any) =>
    (globalThis as any).postMessage(
      compact(run(data), data.type === "init" || data.type === "reset"),
    );
  return run;
}
