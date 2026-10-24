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
  expect(send).toHaveBeenCalledTimes(before + 2);
  vi.useRealTimers();
  vi.restoreAllMocks();
});
