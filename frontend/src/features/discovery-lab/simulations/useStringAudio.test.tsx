import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStringAudio } from "./useStringAudio";

const contexts: FakeAudioContext[] = [];

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state = "running";
  close = vi.fn(async () => {
    this.state = "closed";
  });
  resume = vi.fn(async () => undefined);
  gain = {
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  oscillator = {
    frequency: { value: 0 },
    connect: vi.fn(() => this.gain),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as null | (() => void),
  };
  constructor() {
    contexts.push(this);
  }
  createGain() {
    return this.gain;
  }
  createOscillator() {
    return this.oscillator;
  }
}

const originalAudioContext = globalThis.AudioContext;
const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");

afterEach(() => {
  contexts.length = 0;
  globalThis.AudioContext = originalAudioContext;
  if (hiddenDescriptor)
    Object.defineProperty(document, "hidden", hiddenDescriptor);
});

describe("opt-in string audio lifecycle", () => {
  it("does not autoplay, stays low-gain, and closes when the page is hidden", async () => {
    globalThis.AudioContext =
      FakeAudioContext as unknown as typeof AudioContext;
    const { result } = renderHook(() => useStringAudio());
    expect(contexts).toHaveLength(0);

    await act(async () => result.current.play(235.7, 3));
    expect(contexts).toHaveLength(1);
    expect(contexts[0].oscillator.frequency.value).toBe(235.7);
    expect(contexts[0].gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      expect.any(Number),
      0.02,
    );
    expect(
      contexts[0].gain.gain.linearRampToValueAtTime.mock.calls[0][0],
    ).toBeLessThanOrEqual(0.018);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(contexts[0].close).toHaveBeenCalledOnce();
    expect(result.current.playing).toBe(false);
  });

  it("closes the active context on reset-style stop and unmount", async () => {
    globalThis.AudioContext =
      FakeAudioContext as unknown as typeof AudioContext;
    const { result, unmount } = renderHook(() => useStringAudio());
    await act(async () => result.current.play(235.7, 3));
    act(() => result.current.stop());
    expect(contexts[0].close).toHaveBeenCalledOnce();

    await act(async () => result.current.play(235.7, 3));
    unmount();
    expect(contexts[1].close).toHaveBeenCalledOnce();
  });
});
