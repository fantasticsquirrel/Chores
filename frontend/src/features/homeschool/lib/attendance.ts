import type { HomeschoolAttendance } from "../../../api";

// Named dark colors remain legible against the light subject preview. Labels and
// checkmarks convey selection without relying on color alone.
export const subjectColors = [
  { name: "Sapphire", value: "#1d4ed8" },
  { name: "Emerald", value: "#047857" },
  { name: "Violet", value: "#7e22ce" },
  { name: "Ruby", value: "#be123c" },
  { name: "Amber", value: "#92400e" },
  { name: "Teal", value: "#0e7490" },
  { name: "Indigo", value: "#4338ca" },
  { name: "Slate", value: "#475569" },
];

export function nextSubjectColor(subjects: { color: string }[]): string {
  const used = new Set(subjects.map(({ color }) => color.toLowerCase()));
  const named = subjectColors.find(({ value }) => !used.has(value));
  if (named) return named.value;
  // Keep generating separated, dark hues when the named palette is exhausted.
  for (let index = 0; ; index += 1) {
    const hue = ((index + 1) * 137.508) % 360;
    const saturation = .65; const lightness = .32;
    const channel = (offset: number) => {
      const k = (offset + hue / 30) % 12;
      const a = saturation * Math.min(lightness, 1 - lightness);
      return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
    };
    const color = `#${channel(0)}${channel(8)}${channel(4)}`;
    if (!used.has(color)) return color;
  }
}

export function previousAttendance(records: HomeschoolAttendance[], householdId: number, childId: number, date: string): HomeschoolAttendance[] {
  const previous = records.filter((record) => record.household_id === householdId && record.child_id === childId && record.date < date);
  const latest = previous.reduce((day, record) => record.date > day ? record.date : day, "");
  return previous.filter((record) => record.date === latest);
}

export function isAttendanceDate(value: string | null): value is string {
  if (!value || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
