import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FamilyTreeDialog } from "./FamilyTreeDialog";

describe("FamilyTreeDialog", () => {
  it("portals outside the transformed canvas, names/describes the modal and focuses the first input", () => {
    const { container } = render(
      <div style={{ transform: "scale(.5)" }}>
        <FamilyTreeDialog
          open
          title="Edit River"
          description="Review recorded facts"
          onRequestClose={vi.fn()}
        >
          <label>
            Name
            <input aria-label="Name" />
          </label>
        </FamilyTreeDialog>
      </div>,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit River" });
    expect(container).not.toContainElement(dialog);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Review recorded facts");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  });

  it("requests Escape, close and backdrop dismissal without closing or losing caller-owned drafts", () => {
    const close = vi.fn();
    render(
      <FamilyTreeDialog open title="Edit River" onRequestClose={close}>
        <input aria-label="Draft" defaultValue="Unsaved fact" />
      </FamilyTreeDialog>,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(close).toHaveBeenLastCalledWith("escape");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close Edit River" }),
    );
    expect(close).toHaveBeenLastCalledWith("close-button");
    fireEvent.click(dialog.parentElement!);
    expect(close).toHaveBeenLastCalledWith("backdrop");
    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue(
      "Unsaved fact",
    );
    expect(dialog).toBeInTheDocument();
    expect(close).toHaveBeenCalledTimes(3);
    fireEvent.click(dialog);
    expect(close).toHaveBeenCalledTimes(3);
  });

  it("contains forward/backward Tab navigation and redirects escaped focus", () => {
    render(
      <>
        <button>Outside</button>
        <FamilyTreeDialog open title="Person" onRequestClose={vi.fn()}>
          <input aria-label="First" />
          <button>Last</button>
        </FamilyTreeDialog>
      </>,
    );
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Close Person" });
    const last = within(dialog).getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(close).toHaveFocus();
    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    screen.getByRole("button", { name: "Outside" }).focus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("restores the surviving trigger only after caller-confirmed close, and releases scroll lock", () => {
    const close = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    document.body.style.overflow = "auto";
    const { rerender, unmount } = render(
      <FamilyTreeDialog open title="Edit" onRequestClose={close}>
        <input aria-label="Draft" />
      </FamilyTreeDialog>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(trigger).not.toHaveFocus();
    rerender(
      <FamilyTreeDialog open={false} title="Edit" onRequestClose={close}>
        <input aria-label="Draft" />
      </FamilyTreeDialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("auto");
    unmount();
    trigger.remove();
    document.body.style.overflow = "";
  });

  it("honors requested initial focus and does not refocus when callback identity changes", () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(
      <FamilyTreeDialog
        open
        title="Edit"
        onRequestClose={vi.fn()}
        initialFocusRef={ref}
      >
        <input aria-label="First" />
        <input aria-label="Second" ref={ref} />
      </FamilyTreeDialog>,
    );
    expect(screen.getByRole("textbox", { name: "Second" })).toHaveFocus();
    screen.getByRole("textbox", { name: "First" }).focus();
    rerender(
      <FamilyTreeDialog
        open
        title="Edit"
        onRequestClose={vi.fn()}
        initialFocusRef={ref}
      >
        <input aria-label="First" />
        <input aria-label="Second" ref={ref} />
      </FamilyTreeDialog>,
    );
    expect(screen.getByRole("textbox", { name: "First" })).toHaveFocus();
  });

  it("skips disabled/hidden content when choosing initial focus and trapping Tab", () => {
    render(
      <FamilyTreeDialog open title="Edit" onRequestClose={vi.fn()}>
        <div style={{ display: "none" }}>
          <input aria-label="Hidden ancestor" />
        </div>
        <input aria-label="Disabled" disabled />
        <input aria-label="Visible" />
        <button hidden>Hidden last</button>
      </FamilyTreeDialog>,
    );
    expect(screen.getByRole("textbox", { name: "Visible" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Visible" }), {
      key: "Tab",
    });
    expect(screen.getByRole("button", { name: "Close Edit" })).toHaveFocus();
  });

  it("keeps only the top nested confirmation active and restores parent focus/scroll ownership", () => {
    const parentClose = vi.fn(),
      confirmationClose = vi.fn();
    const { rerender, unmount } = render(
      <>
        <FamilyTreeDialog open title="Edit" onRequestClose={parentClose}>
          <button>Discard draft?</button>
        </FamilyTreeDialog>
        <FamilyTreeDialog
          open={false}
          title="Confirm discard"
          onRequestClose={confirmationClose}
        >
          <button>Keep editing</button>
        </FamilyTreeDialog>
      </>,
    );
    const parent = screen.getByRole("dialog", { name: "Edit" });
    const trigger = within(parent).getByRole("button", {
      name: "Discard draft?",
    });
    trigger.focus();
    rerender(
      <>
        <FamilyTreeDialog open title="Edit" onRequestClose={parentClose}>
          <button>Discard draft?</button>
        </FamilyTreeDialog>
        <FamilyTreeDialog
          open
          title="Confirm discard"
          onRequestClose={confirmationClose}
        >
          <button>Keep editing</button>
        </FamilyTreeDialog>
      </>,
    );
    expect(parent.parentElement).toHaveAttribute("inert");
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Confirm discard" }), {
      key: "Escape",
    });
    expect(confirmationClose).toHaveBeenCalledWith("escape");
    expect(parentClose).not.toHaveBeenCalled();
    rerender(
      <>
        <FamilyTreeDialog open title="Edit" onRequestClose={parentClose}>
          <button>Discard draft?</button>
        </FamilyTreeDialog>
        <FamilyTreeDialog
          open={false}
          title="Confirm discard"
          onRequestClose={confirmationClose}
        >
          <button>Keep editing</button>
        </FamilyTreeDialog>
      </>,
    );
    expect(trigger).toHaveFocus();
    expect(parent.parentElement).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("does not render or lock scroll when closed", () => {
    const overflow = document.body.style.overflow;
    render(
      <FamilyTreeDialog open={false} title="Edit" onRequestClose={vi.fn()}>
        Hidden
      </FamilyTreeDialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe(overflow);
  });
});
