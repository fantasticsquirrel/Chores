import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../ui/Button";
import {
  focusableElements,
  registerModal,
} from "../lib/presentation/dialogFocus";
import "./family-tree.css";

export type FamilyTreeDialogCloseReason =
  | "escape"
  | "close-button"
  | "backdrop";
export interface FamilyTreeDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onRequestClose: (reason: FamilyTreeDialogCloseReason) => void;
  initialFocusRef?: RefObject<HTMLElement>;
}

/** Controlled portal. Every dismissal requests caller policy; none changes open. */
export function FamilyTreeDialog({
  open,
  title,
  description,
  children,
  onRequestClose,
  initialFocusRef,
}: FamilyTreeDialogProps) {
  const titleId = useId(),
    descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(onRequestClose);
  const initialRef = useRef(initialFocusRef);
  requestRef.current = onRequestClose;
  initialRef.current = initialFocusRef;
  useEffect(() => {
    if (!open || !dialogRef.current || !overlayRef.current) return;
    const dialog = dialogRef.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const ownership = registerModal(overlayRef.current, dialog);
    const initial = initialRef.current?.current;
    const contentFocusable = contentRef.current
      ? focusableElements(contentRef.current)
      : [];
    const preferred =
      initial && focusableElements(dialog).includes(initial)
        ? initial
        : contentFocusable[0];
    (preferred ?? dialog).focus();
    function containFocus(event: FocusEvent) {
      if (ownership.isTop() && !dialog.contains(event.target as Node))
        (focusableElements(dialog)[0] ?? dialog).focus();
    }
    function keyboard(event: KeyboardEvent) {
      if (!ownership.isTop()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestRef.current("escape");
      } else if (event.key === "Tab") {
        const elements = focusableElements(dialog);
        const first = elements[0],
          last = elements[elements.length - 1];
        const active = document.activeElement;
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (
          event.shiftKey &&
          (active === first || active === dialog || !dialog.contains(active))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (active === last || active === dialog || !dialog.contains(active))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("focusin", containFocus);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("focusin", containFocus);
      document.removeEventListener("keydown", keyboard, true);
      ownership.release();
      if (previous?.isConnected && !previous.closest("[inert]"))
        previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      ref={overlayRef}
      className="family-tree-dialog-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onRequestClose("backdrop");
      }}
    >
      <div
        ref={dialogRef}
        className="family-tree-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="family-tree-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <Button
            className="family-tree-control"
            onClick={() => onRequestClose("close-button")}
            aria-label={`Close ${title}`}
          >
            Close
          </Button>
        </header>
        {description && (
          <p id={descriptionId} className="family-tree-dialog-description">
            {description}
          </p>
        )}
        <div className="family-tree-dialog-content" ref={contentRef}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
