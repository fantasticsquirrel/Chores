import { installLesson } from "../physical-lesson";
import { initialMagnetic, normalizeMagnetic, magneticResult } from "./model";
import { createMagneticFieldsScene } from "./magnets";
installLesson({
  initial: initialMagnetic,
  normalize: normalizeMagnetic,
  build: createMagneticFieldsScene,
  title: "Which way does a compass point between two magnets?",
  introduction:
    "A compass north-seeking tip follows the combined local field. Outside a magnet the field goes from north toward south.",
  fields: [
    {
      id: "gap",
      label: "Gap between bars (diagram units)",
      min: 0.5,
      max: 4.5,
      step: 0.1,
    },
    { id: "flipped", label: "Flip right magnet", toggle: true },
    {
      id: "probeX",
      label: "Compass x (diagram units)",
      min: -6,
      max: 6,
      step: 0.1,
    },
    {
      id: "probeZ",
      label: "Compass z (diagram units)",
      min: -4,
      max: 4,
      step: 0.1,
    },
  ],
  select: (s, i) =>
    i === 1 || i === 2
      ? { ...s, flipped: i === 1 }
      : i >= 10
        ? {
            ...s,
            probeX: Math.round((-5.4 + ((i - 10) % 7) * 1.8) * 10) / 10,
            probeZ: -2.9 + Math.floor((i - 10) / 7) * 2.9,
          }
        : s,
  describe: (s) => {
    const r = magneticResult(s);
    return `Facing poles ${r.interaction}. ${r.insideMagnet ? "Probe inside a bar: outside model domain; move it outside." : r.direction === null ? "Contributions cancel: no preferred compass direction." : `North tip ${Math.round(r.direction)}° from +x; field strength ${r.strength.toFixed(2)} relative units.`} The compass follows the vector sum, not simply the nearest magnet.`;
  },
  trials: [
    {
      title: "Reverse one magnet",
      question:
        "Will reversing only the right magnet change attraction to repulsion?",
      choices: ["Interaction stays the same", "Interaction reverses"],
      controlled:
        "Keep gap 2 and probe (0,2). Compare facing pole letters, force arrows and compass before and after reversing the right bar.",
      before: initialMagnetic,
      after: { ...initialMagnetic, flipped: true },
      change: "Reverse right bar",
      explain:
        "Which poles face across the gap in each case? How does the compass respond to the combined field?",
    },
    {
      title: "Test cancellation",
      question:
        "With north poles facing, will the compass have a direction exactly halfway between them?",
      choices: ["A definite direction", "Contributions cancel"],
      controlled:
        "Keep north poles facing with gap 2. Compare probe (0,0) and (0,2), changing only z.",
      before: { ...initialMagnetic, flipped: true, probeZ: 0 },
      after: { ...initialMagnetic, flipped: true, probeZ: 2 },
      change: "Move compass z to 2",
      explain:
        "Why can equal opposing contributions cancel at one point but not everywhere? Does weak field mean the magnets stopped being magnets?",
    },
  ],
  note: "Positions and field strengths are diagram units, not metres or tesla. Identical magnets are paired softened pole sources for exterior field only; poles do not exist separately in this model or as known isolated magnetic charges. Lines and arrows represent direction, not physical threads; field-line density is illustrative. Earth’s field and nearby objects are omitted; no force or magnet trajectory is calculated.",
});
