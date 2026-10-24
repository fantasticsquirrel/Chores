import type { DiscoveryPackagePayload } from "@family-manager/family-api/models";
import { apiClient } from "../../../api";
const MAX_BYTES = 3 * 1024 * 1024;
const content = new Map<string, DiscoveryPackagePayload>();
let cacheIdentity = "";
/** Session memory only: normalized payload cannot be verified against the ZIP hash. */
export function clearPackageContentCache() {
  content.clear();
  cacheIdentity = "";
}
function save(payload: DiscoveryPackagePayload) {
  const size = JSON.stringify(payload).length;
  if (size > MAX_BYTES) return;
  content.delete(payload.checksum);
  let total = size;
  for (const value of content.values()) total += JSON.stringify(value).length;
  while (content.size >= 4 || total > MAX_BYTES) {
    const key = content.keys().next().value;
    if (!key) break;
    total -= JSON.stringify(content.get(key)).length;
    content.delete(key);
  }
  content.set(payload.checksum, payload);
}
export async function loadAuthorizedPackage(
  id: string,
  identity = "",
): Promise<DiscoveryPackagePayload> {
  if (identity !== cacheIdentity) {
    clearPackageContentCache();
    cacheIdentity = identity;
  }
  // Always check the server, even when immutable content is available in memory.
  const detail = await apiClient.getDiscoveryExploration(id);
  if (!detail.package) throw new Error("This package is no longer published.");
  let payload = content.get(detail.package.checksum);
  if (
    !payload ||
    payload.manifest.package_id !== id ||
    payload.manifest.version !== detail.package.version
  )
    payload = await apiClient.getDiscoveryPackage(id);
  if (
    payload.checksum !== detail.package.checksum ||
    payload.manifest.package_id !== id ||
    payload.manifest.version !== detail.package.version
  )
    throw new Error("The published version changed. Refresh to verify access.");
  if (cacheIdentity === identity) save(payload);
  return payload;
}
export function withAuthorizationDeadline<T>(read: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error("Access verification timed out. Reconnect and try again."),
        ),
      5000,
    );
    read.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
