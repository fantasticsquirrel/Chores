import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkerRuntime } from "./WorkerRuntime";

const audio = vi.hoisted(() => ({
  play: vi.fn(() => true),
  dispose: vi.fn(),
  create: vi.fn(),
}));

vi.mock("./bridge", async (original) => ({
  ...(await original<typeof import("./bridge")>()),
  sandboxDocument: async (cap: string) => `<p>${cap}</p>`,
}));
vi.mock("./rich/audio", async (original) => ({
  ...(await original<typeof import("./rich/audio")>()),
  createTonePlayer: () => {
    audio.create();
    return { play: audio.play, dispose: audio.dispose };
  },
}));

const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");

afterEach(() => {
  vi.clearAllMocks();
  if (hiddenDescriptor)
    Object.defineProperty(document, "hidden", hiddenDescriptor);
});

it("starts package audio only from its button and disposes it on reset, visibility and unmount", async () => {
  const payload = {
    checksum: "audio-content",
    manifest: { runtime: "worker-rich-v1", entry: "worker.js" },
    assets: [
      { path: "worker.js", content_base64: btoa("self.onmessage=()=>{}") },
    ],
  };
  const view = render(<WorkerRuntime payload={payload as never} />);
  const frame = (await screen.findByTitle(
    "Isolated simulation engine",
  )) as HTMLIFrameElement;
  await waitFor(() => expect(frame.srcdoc).toContain("<p>"));
  const cap = frame.srcdoc.slice(3, -4);
  const target = frame.contentWindow!;
  const deliver = (type: string, data?: unknown) =>
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          source: target,
          data: { cap, type, data },
        }),
      ),
    );

  deliver("ready");
  const scene = {
    description: "Optional pure tone with complete visual evidence.",
    animate: false,
    shapes: [],
    controls: [],
    buttons: [{ id: "listen", label: "Hear low-gain pure tone" }],
    audio: [
      {
        buttonId: "listen",
        frequency: 235.7,
        duration: 0.85,
        gain: 0.01,
        waveform: "sine",
      },
    ],
  };
  deliver("scene", scene);
  expect(audio.create).not.toHaveBeenCalled();
  expect(audio.play).not.toHaveBeenCalled();

  fireEvent.click(
    screen.getByRole("button", { name: "Hear low-gain pure tone" }),
  );
  expect(audio.create).toHaveBeenCalledOnce();
  expect(audio.play).toHaveBeenCalledOnce();

  deliver("scene", { ...scene, audio: [] });
  expect(audio.dispose).toHaveBeenCalledOnce();
  deliver("scene", scene);
  fireEvent.click(
    screen.getByRole("button", { name: "Hear low-gain pure tone" }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Reset experiment" }));
  expect(audio.dispose).toHaveBeenCalledTimes(2);

  fireEvent.click(
    screen.getByRole("button", { name: "Hear low-gain pure tone" }),
  );
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(audio.dispose).toHaveBeenCalledTimes(3);

  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Hear low-gain pure tone" }),
  );
  view.unmount();
  expect(audio.dispose).toHaveBeenCalledTimes(4);
});
