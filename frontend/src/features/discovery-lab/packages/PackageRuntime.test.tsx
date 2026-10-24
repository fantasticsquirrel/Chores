import { clearPackageContentCache } from "./packageCache";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../api";
import { AuthorizedPackage } from "./PackageRuntime";
const payload = {
  checksum: "test",
  assets: [],
  manifest: {
    package_id: "test",
    version: "1",
    runtime: "declarative-v1",
    scene: {
      kind: "linear",
      controls: [
        {
          id: "speed",
          label: "Speed",
          min: 1,
          max: 10,
          step: 1,
          initial: 2,
          unit: "m/s",
        },
      ],
      output: { label: "Distance", unit: "m" },
      coefficient: 3,
    },
  },
};
describe("package authorization lifecycle", () => {
  beforeEach(() => {
    clearPackageContentCache();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    vi.spyOn(apiClient, "getDiscoveryExploration").mockResolvedValue({
      id: "test",
      package: { version: "1", checksum: "test" },
    } as never);
    vi.spyOn(apiClient, "getDiscoveryPackage").mockResolvedValue(
      payload as never,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("explicitly rejects a future runtime instead of substituting a bundled or declarative activity", async () => {
    vi.mocked(apiClient.getDiscoveryPackage).mockResolvedValue({
      ...payload,
      manifest: { ...payload.manifest, runtime: "future-runtime-v9" },
    } as never);
    render(<AuthorizedPackage id="test" identity="parent" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "requires a newer application",
    );
    expect(screen.queryByLabelText("Speed")).not.toBeInTheDocument();
  });
  it("shows a working relationship and stops immediately offline", async () => {
    render(<AuthorizedPackage id="test" identity="parent" />);
    expect(await screen.findByRole("slider")).toHaveValue("2");
    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Reconnect");
  });
  it("removes cached runtime after a fresh revocation", async () => {
    render(<AuthorizedPackage id="test" identity="child" />);
    await screen.findByRole("slider");
    vi.mocked(apiClient.getDiscoveryExploration).mockRejectedValue(
      new Error("Forbidden"),
    );
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() =>
      expect(screen.queryByRole("slider")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Forbidden");
  });
});

it("enlarges only the scrollable diagram and preserves experiment controls", async () => {
  clearPackageContentCache();
  vi.spyOn(apiClient, "getDiscoveryExploration").mockResolvedValue({
    id: "test",
    package: { version: "1", checksum: "test" },
  } as never);
  vi.spyOn(apiClient, "getDiscoveryPackage").mockResolvedValue(
    payload as never,
  );
  render(<AuthorizedPackage id="test" identity="parent" />);
  const enlarge = await screen.findByRole("button", {
    name: "Enlarge diagram",
  });
  fireEvent.change(screen.getByRole("slider"), { target: { value: "5" } });
  fireEvent.click(enlarge);
  expect(screen.getByRole("button", { name: "Fit diagram" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByRole("region", { name: "Simulation diagram" }),
  ).toHaveStyle({ overflowX: "auto", maxWidth: "100%" });
  expect(screen.getByRole("img").parentElement).toHaveStyle({
    minWidth: "800px",
  });
  fireEvent.click(screen.getByRole("button", { name: "Reset experiment" }));
  expect(screen.getByRole("slider")).toHaveValue("2");
  fireEvent.click(screen.getByRole("button", { name: "Fit diagram" }));
  expect(screen.getByRole("img").parentElement).toHaveStyle({ minWidth: "0" });
  vi.restoreAllMocks();
});

it("stops automatic steps for static workers while preserving controls and reset", async () => {
  const { PackagePreview } = await import("./PackageRuntime");
  render(
    <PackagePreview
      payload={
        {
          checksum: "static",
          assets: [
            { path: "entry.js", content_base64: btoa("self.onmessage=()=>{}") },
          ],
          manifest: { runtime: "worker-v1", entry: "entry.js" },
        } as never
      }
    />,
  );
  const iframe = (await screen.findByTitle(
    "Isolated simulation engine",
  )) as HTMLIFrameElement;
  const cap = iframe.srcdoc.match(/const cap=("[^"]+")/)?.[1];
  expect(cap).toBeTruthy();
  const send = vi.spyOn(iframe.contentWindow!, "postMessage");
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { cap: JSON.parse(cap!), type: "ready" },
      }),
    ),
  );
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          cap: JSON.parse(cap!),
          type: "scene",
          data: {
            description: "Static evidence",
            shapes: [],
            animate: false,
            controls: [
              { id: "time", label: "Time", min: 0, max: 10, step: 1, value: 0 },
            ],
          },
        },
      }),
    ),
  );
  expect(
    screen.queryByRole("button", { name: "Pause" }),
  ).not.toBeInTheDocument();
  const before = send.mock.calls.length;
  vi.useFakeTimers();
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(send).toHaveBeenCalledTimes(before);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
  expect(send).toHaveBeenCalledTimes(before + 1);
  fireEvent.click(screen.getByRole("button", { name: "Reset experiment" }));
  // Reset waits for the previous response rather than being dropped by the worker.
  expect(send).toHaveBeenCalledTimes(before + 1);
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          cap: JSON.parse(cap!),
          type: "scene",
          data: {
            description: "Changed evidence",
            shapes: [],
            animate: false,
            controls: [
              { id: "time", label: "Time", min: 0, max: 10, step: 1, value: 2 },
            ],
          },
        },
      }),
    ),
  );
  expect(send).toHaveBeenCalledTimes(before + 2);
  expect(send.mock.calls.at(-1)?.[0].data.type).toBe("reset");
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          cap: JSON.parse(cap!),
          type: "scene",
          data: {
            description: "Reset evidence",
            shapes: [],
            animate: false,
            controls: [
              { id: "time", label: "Time", min: 0, max: 10, step: 1, value: 0 },
            ],
          },
        },
      }),
    ),
  );
  expect(screen.getByRole("slider")).toHaveValue("0");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("queues intents against authoritative button changes instead of stale control snapshots", async () => {
  const { PackagePreview } = await import("./PackageRuntime");
  render(
    <PackagePreview
      payload={
        {
          checksum: "queued",
          assets: [
            { path: "entry.js", content_base64: btoa("self.onmessage=()=>{}") },
          ],
          manifest: { runtime: "worker-v1", entry: "entry.js" },
        } as never
      }
    />,
  );
  const iframe = (await screen.findByTitle(
    "Isolated simulation engine",
  )) as HTMLIFrameElement;
  const cap = JSON.parse(iframe.srcdoc.match(/const cap=("[^"]+")/)![1]);
  const post = vi.spyOn(iframe.contentWindow!, "postMessage");
  const emit = (type: string, data?: unknown) =>
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          source: iframe.contentWindow,
          data: { cap, type, data },
        }),
      ),
    );
  const output = (gate: number, towers = 1) => ({
    description: "Gate evidence",
    shapes: [],
    animate: false,
    controls: [
      {
        id: "gate",
        label: "Close gate",
        kind: "toggle",
        min: 0,
        max: 1,
        step: 1,
        value: gate,
      },
      {
        id: "towers",
        label: "Towers",
        kind: "toggle",
        min: 0,
        max: 1,
        step: 1,
        value: towers,
      },
    ],
    buttons: [
      { id: "open", label: "Test open gate" },
      { id: "compare", label: "Compare sight lines" },
    ],
  });
  emit("ready");
  emit("scene", output(1));
  fireEvent.click(screen.getByRole("button", { name: "Test open gate" }));
  fireEvent.click(screen.getByRole("button", { name: "Compare sight lines" }));
  expect(post.mock.calls.at(-1)?.[0].data.control).toBe("open");
  emit("scene", output(0));
  expect(post.mock.calls.at(-1)?.[0].data.control).toBe("compare");
  expect(post.mock.calls.at(-1)?.[0].data.values.gate).toBe(0);
  emit("scene", output(0));
  expect(
    screen.getByRole("checkbox", { name: "Close gate" }),
  ).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Towers" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Close gate" }));
  emit("scene", output(0, 0));
  expect(post.mock.calls.at(-1)?.[0].data.values).toEqual({
    gate: 1,
    towers: 0,
  });
  emit("scene", output(1, 0));
  expect(screen.getByRole("checkbox", { name: "Close gate" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Towers" })).not.toBeChecked();
  vi.restoreAllMocks();
});
