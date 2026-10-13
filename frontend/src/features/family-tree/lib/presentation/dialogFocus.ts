const focusSelector =
  'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]';
export function focusableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(focusSelector)].filter(
    (element) => {
      if (
        element.tabIndex < 0 ||
        element.matches(":disabled") ||
        element.closest('[hidden], [inert], [aria-hidden="true"]')
      )
        return false;
      for (
        let ancestor: HTMLElement | null = element;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor);
        if (style.display === "none" || style.visibility === "hidden")
          return false;
        if (ancestor === root) break;
      }
      return true;
    },
  );
}
interface ModalEntry {
  overlay: HTMLElement;
  dialog: HTMLElement;
}
const stack: ModalEntry[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow = "";

function syncBackground() {
  const top = stack[stack.length - 1];
  for (const child of document.body.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (!originalInert.has(child))
      originalInert.set(child, child.hasAttribute("inert"));
    if (child === top?.overlay) child.removeAttribute("inert");
    else child.setAttribute("inert", "");
  }
}
/** LIFO modal ownership supports a caller's nested unsaved-draft confirmation. */
export function registerModal(overlay: HTMLElement, dialog: HTMLElement) {
  const entry = { overlay, dialog };
  if (!stack.length) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  stack.push(entry);
  syncBackground();
  return {
    isTop: () => stack[stack.length - 1] === entry,
    release: () => {
      const index = stack.indexOf(entry);
      if (index >= 0) stack.splice(index, 1);
      if (stack.length) syncBackground();
      else {
        for (const [element, wasInert] of originalInert) {
          if (wasInert) element.setAttribute("inert", "");
          else element.removeAttribute("inert");
        }
        originalInert.clear();
        document.body.style.overflow = originalOverflow;
      }
    },
  };
}
