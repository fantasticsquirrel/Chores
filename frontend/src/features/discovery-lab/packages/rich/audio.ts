import { z } from "zod";
const schema = z
  .array(
    z
      .object({
        buttonId: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
        frequency: z.number().finite().min(40).max(2000),
        duration: z.number().finite().min(0.01).max(2),
        gain: z.number().finite().min(0).max(0.15),
        waveform: z.enum(["sine", "triangle"]).default("sine"),
      })
      .strict(),
  )
  .max(8);
export type Tone = z.infer<typeof schema>[number];
export function parseTones(
  value: unknown,
  buttonIds: ReadonlySet<string>,
): Tone[] | null {
  const parsed = schema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.some((t) => !buttonIds.has(t.buttonId)) ||
    new Set(parsed.data.map((t) => t.buttonId)).size !== parsed.data.length
  )
    return null;
  return parsed.data;
}
/** Called synchronously only from an explicit user button gesture. No automatic audio. */
export function createTonePlayer() {
  let context: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  return {
    play(tone: Tone) {
      try {
        context ??= new AudioContext();
        void context.resume();
        oscillator?.stop();
        const next = context.createOscillator(),
          gain = context.createGain(),
          now = context.currentTime;
        next.type = tone.waveform;
        next.frequency.value = tone.frequency;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(tone.gain, now + 0.01);
        gain.gain.linearRampToValueAtTime(0, now + tone.duration);
        next.connect(gain);
        gain.connect(context.destination);
        next.start();
        next.stop(now + tone.duration);
        oscillator = next;
        next.onended = () => {
          next.disconnect();
          gain.disconnect();
          if (oscillator === next) oscillator = null;
        };
        return true;
      } catch {
        return false;
      }
    },
    dispose() {
      try {
        oscillator?.stop();
      } catch {
        /* Already ended. */
      }
      oscillator = null;
      if (context && context.state !== "closed")
        void context.close().catch(() => undefined);
      context = null;
    },
  };
}
