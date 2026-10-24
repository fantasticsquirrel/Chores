import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { WorkerRuntime } from "./WorkerRuntime";
vi.mock("./bridge", async (original) => ({
  ...(await original<typeof import("./bridge")>()),
  sandboxDocument: async (cap: string) => `<p>${cap}</p>`,
}));
it("keeps the running worker when reauthorization returns the same immutable checksum", async () => {
  const payload = {
    checksum: "same-content",
    manifest: { runtime: "worker-v1", entry: "worker.js" },
    assets: [
      { path: "worker.js", content_base64: btoa("self.onmessage=()=>{}") },
    ],
  };
  const { rerender } = render(<WorkerRuntime payload={payload as never} />);
  const frame = (await screen.findByTitle(
    "Isolated simulation engine",
  )) as HTMLIFrameElement;
  await waitFor(() => expect(frame.srcdoc).toContain("<p>"));
  const cap = frame.srcdoc.slice(3, -4);
  const target = frame.contentWindow!;
  const send = vi.spyOn(target, "postMessage");
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: target,
        data: { cap, type: "ready" },
      }),
    ),
  );
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: target,
        data: {
          cap,
          type: "scene",
          data: {
            description: "Control evidence",
            animate: false,
            shapes: [],
            controls: [
              {
                id: "amount",
                label: "Amount",
                min: 0,
                max: 10,
                step: 1,
                value: 2,
              },
            ],
          },
        },
      }),
    ),
  );
  rerender(
    <WorkerRuntime
      payload={
        { ...payload, assets: payload.assets.map((a) => ({ ...a })) } as never
      }
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  send.mockClear();
  fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "input",
      data: expect.objectContaining({ type: "control", control: "amount" }),
    }),
    "*",
  );
  send.mockRestore();
});
it("preserves deliberate queued controls across reauthorization and resets on a new checksum mount", async () => {
  const payload = {
    checksum: "first",
    manifest: { runtime: "worker-v1", entry: "worker.js" },
    assets: [
      { path: "worker.js", content_base64: btoa("self.onmessage=()=>{}") },
    ],
  };
  const { rerender } = render(
    <WorkerRuntime key={payload.checksum} payload={payload as never} />,
  );
  const frame = (await screen.findByTitle(
    "Isolated simulation engine",
  )) as HTMLIFrameElement;
  await waitFor(() => expect(frame.srcdoc).toContain("<p>"));
  const cap = frame.srcdoc.slice(3, -4),
    target = frame.contentWindow!;
  const send = vi.spyOn(target, "postMessage");
  const scene = (value: number) => ({
    description: "Control evidence",
    animate: false,
    shapes: [],
    controls: [
      { id: "amount", label: "Amount", min: 0, max: 10, step: 1, value },
    ],
  });
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
  deliver("scene", scene(2));
  fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
  fireEvent.change(screen.getByRole("slider"), { target: { value: "4" } });
  rerender(
    <WorkerRuntime
      key={payload.checksum}
      payload={
        { ...payload, assets: payload.assets.map((a) => ({ ...a })) } as never
      }
    />,
  );
  send.mockClear();
  deliver("scene", scene(3));
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ type: "control", values: { amount: 4 } }),
    }),
    "*",
  );
  deliver("scene", scene(4));
  expect(screen.getByRole("slider")).toHaveValue("4");
  rerender(
    <WorkerRuntime
      key="second"
      payload={{ ...payload, checksum: "second" } as never}
    />,
  );
  expect(screen.queryByRole("slider")).toBeNull();
  deliver("scene", scene(9));
  expect(screen.queryByRole("slider")).toBeNull();
  const next = (await screen.findByTitle(
    "Isolated simulation engine",
  )) as HTMLIFrameElement;
  await waitFor(() => expect(next.srcdoc).toContain("<p>"));
  const nextCap = next.srcdoc.slice(3, -4);
  expect(nextCap).not.toBe(cap);
  const nextSend = vi.spyOn(next.contentWindow!, "postMessage");
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: next.contentWindow,
        data: { cap: nextCap, type: "ready" },
      }),
    ),
  );
  expect(nextSend).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ type: "reset", values: {} }),
    }),
    "*",
  );
  send.mockRestore();
  nextSend.mockRestore();
});
