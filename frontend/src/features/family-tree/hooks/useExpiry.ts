import { useEffect, useState } from "react";
import type { FamilyTreeJob } from "../../../api";
export function useExpiry(job: FamilyTreeJob | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!job) return;
    const remaining = Date.parse(job.expires_at) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      setNow(Date.now());
      return;
    }
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(remaining + 1, 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [job]);
  return now;
}
