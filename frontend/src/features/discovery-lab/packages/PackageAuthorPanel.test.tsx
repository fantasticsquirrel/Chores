import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiClient } from "../../../api";
import { PackageAuthorPanel } from "./PackageAuthorPanel";
vi.mock("./PackageRuntime", () => ({
  PackagePreview: () => <div>Preview</div>,
}));
afterEach(() => vi.restoreAllMocks());
it("groups versions by package, exposes current version and searches without changing publish scope", async () => {
  const versions = [
    {
      package_id: "orbit",
      version: "1.0.0",
      published: false,
      runtime: "worker-rich-v1" as const,
      checksum: "a",
      created_at: "2026-01-01",
    },
    {
      package_id: "orbit",
      version: "2.0.0",
      published: true,
      runtime: "worker-rich-v1" as const,
      checksum: "b",
      created_at: "2026-02-01",
    },
    {
      package_id: "leaf",
      version: "1.0.0",
      published: true,
      runtime: "worker-rich-v1" as const,
      checksum: "c",
      created_at: "2026-01-01",
    },
  ];
  vi.spyOn(apiClient, "listDiscoveryPackages").mockResolvedValue(versions);
  const published = vi
    .spyOn(apiClient, "publishDiscoveryPackage")
    .mockResolvedValue(versions[0]);
  render(<PackageAuthorPanel identity="1:1" onPublished={vi.fn()} />);
  expect(await screen.findByText("Current version: 2.0.0")).toBeVisible();
  expect(screen.getByRole("heading", { name: "orbit" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Search packages"), {
    target: { value: "orbit" },
  });
  expect(
    screen.queryByRole("heading", { name: "leaf" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Publish 1.0.0" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Other versions (1)"));
  fireEvent.click(screen.getByRole("button", { name: "Publish 1.0.0" }));
  await waitFor(() => expect(published).toHaveBeenCalledWith("orbit", "1.0.0"));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Review Child access",
  );
});
