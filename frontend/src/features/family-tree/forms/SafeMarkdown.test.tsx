import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { SafeMarkdown } from "./SafeMarkdown";
afterEach(() => vi.restoreAllMocks());
describe("Safe limited genealogy Markdown", () => {
  it("escapes raw HTML and never embeds or fetches remote images", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { container } = render(
      <SafeMarkdown
        text={
          '<img src="https://remote.test/image.jpg" onerror="alert(1)">\n\n![remote](https://remote.test/photo.png)\n\n<script>alert(1)</script>'
        }
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<img src=");
    expect(container.textContent).toContain("![remote]");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("supports limited text markup and explicit safe source links without automatic source fetch", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    render(
      <SafeMarkdown
        text={
          "# Recorded account\n\n**Evidence** [Source](https://source.test/record)\n\n- First fact\n- Second fact"
        }
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Recorded account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evidence").tagName).toBe("STRONG");
    const link = screen.getByRole("link", { name: "Source" });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("href", "https://source.test/record");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("leaves executable URL syntax escaped rather than making an unsafe link", () => {
    const { container } = render(
      <SafeMarkdown
        text={
          "[Unsafe](javascript:alert(1))\n\n[Data](data:text/html,<script>bad</script>)"
        }
      />,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });
});
