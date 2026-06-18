import type { Child, Chore, CompletionMode } from "../../../api";

export function scheduleLabel(chore: Chore): string {
  switch (chore.schedule_mode) {
    case "NONE":
      return "On-demand";
    case "ONCE":
      return `Once on ${chore.start_date}`;
    case "EVERY":
      return `Every ${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""}`;
    case "AFTER_COMPLETION":
      return `${chore.schedule_interval ?? "?"} ${chore.schedule_unit ?? ""} after completion`;
    default:
      return chore.schedule_mode;
  }
}

export function completionLabel(mode: CompletionMode): string {
  return mode === "SHARED" ? "Shared completion" : "Per-child completion";
}

export function eligibilityLabel(chore: Chore, children: Child[]): string {
  if (chore.assignment_mode === "ROTATING") {
    const names = chore.rotation_order
      .map((id) => children.find((child) => child.id === id)?.name ?? `#${id}`)
      .join(" then ");
    return `Rotation: ${names || "none set"}`;
  }

  if (chore.allowed_child_ids.length === 0) return "All children";
  return chore.allowed_child_ids
    .map((id) => children.find((child) => child.id === id)?.name ?? `#${id}`)
    .join(", ");
}

export function buildTimingLabel(chore: Chore): string {
  const labels: string[] = [];
  if (chore.expires_at !== null) labels.push(`Ends ${chore.expires_at}`);
  if (chore.timeout_days !== null)
    labels.push(
      `Window ${chore.timeout_days} day${chore.timeout_days === 1 ? "" : "s"}`,
    );
  return labels.join(" - ");
}
