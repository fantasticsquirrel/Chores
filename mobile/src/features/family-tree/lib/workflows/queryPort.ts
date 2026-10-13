import type * as FT from "@family-manager/family-api/models";
import type { TreeApi } from "./commands";
import type { TreeState } from "./state";
import type { RequestGroup } from "./requests";
export type TreeRequestMethod = Exclude<
  keyof TreeApi,
  "authenticationGeneration" | "withAuthentication" | "getMyModules"
>;
/** All query paths use the same scope/authority, cancellation and publication owner. */
export interface TreeReadPort {
  state: () => TreeState;
  readable: () => boolean;
  valid: (epoch: number) => boolean;
  epoch: () => number;
  selection: () => number;
  update: (changes: Partial<TreeState>) => void;
  readError: (error: unknown) => Promise<void>;
  supersedeGraph: () => void;
  directoryFilters: () => FT.FamilyTreePeopleParams;
  graphParams: () => Readonly<FT.FamilyTreeGraphParams>;
  request: <M extends TreeRequestMethod>(
    group: RequestGroup,
    method: M,
    ...args: Parameters<TreeApi[M]>
  ) => ReturnType<TreeApi[M]>;
}
