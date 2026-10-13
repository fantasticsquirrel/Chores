import type { RequestOptions } from "@family-manager/family-api/client-core";
// The hook owns one ledger per mounted household/user/auth generation.
export type TreeRequestOptions = RequestOptions;
export type RequestGroup =
  | "snapshot"
  | "graph"
  | "detail"
  | "people"
  | "stories"
  | "residences"
  | "candidates"
  | "compare"
  | "identities"
  | "mutation";
export class TreeRequests {
  private controllers = new Map<RequestGroup, AbortController>();
  begin(group: RequestGroup): TreeRequestOptions {
    this.cancel(group);
    const controller = new AbortController();
    this.controllers.set(group, controller);
    return { signal: controller.signal };
  }
  finish(group: RequestGroup, options: TreeRequestOptions) {
    if (this.controllers.get(group)?.signal === options.signal)
      this.controllers.delete(group);
  }
  cancel(...groups: RequestGroup[]) {
    for (const group of groups) {
      this.controllers.get(group)?.abort();
      this.controllers.delete(group);
    }
  }
  cancelReads() {
    for (const group of [...this.controllers.keys()])
      if (group !== "mutation") this.cancel(group);
  }
  cancelAll() {
    this.cancel(...this.controllers.keys());
  }
}
