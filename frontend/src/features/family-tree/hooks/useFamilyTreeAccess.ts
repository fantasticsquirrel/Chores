import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../api";
import { useAuth } from "../../../auth/useAuth";
import { formatApiError } from "../../../lib/errors";
import { cancellable } from "../lib/workflows/workflows";

export type TreeAccess = {
  state: "loading" | "allowed" | "denied" | "error";
  manage: boolean;
  error: string | null;
  owner: string | null;
  checking?: boolean;
};
export function useFamilyTreeAccess() {
  const { status, user, moduleKeys, manageableModuleKeys } = useAuth();
  const session = useRef<{ user: typeof user; epoch: number }>({
    user: null,
    epoch: 0,
  });
  if (session.current.user !== user) {
    session.current = { user, epoch: session.current.epoch + 1 };
  }
  const owner =
    status === "authenticated" &&
    user &&
    (user.role === "PARENT" || user.role === "PARENT_ADMIN")
      ? `${user.household_id}:${user.id}:${session.current.epoch}`
      : null;
  const [access, setAccess] = useState<TreeAccess>({
    state: "loading",
    manage: false,
    error: null,
    owner: null,
  });
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const generation = useRef({ request: 0 });
  const discovery = useRef<{ controller: AbortController | null }>({
    controller: null,
  });
  const previous = useRef<{
    view: boolean;
    manage: boolean;
    owner: string | null;
  }>({ view: false, manage: false, owner: null });
  const refresh = useCallback(async () => {
    const request = ++generation.current.request;
    discovery.current.controller?.abort();
    const controller = new AbortController();
    discovery.current.controller = controller;
    setAccess((current) =>
      current.owner === owner && current.state === "allowed"
        ? { ...current, checking: true }
        : {
            state: owner ? "loading" : "denied",
            manage: false,
            error: null,
            owner,
          },
    );
    if (!owner) return;
    try {
      const response = await cancellable(
        apiClient.getMyModules({ signal: controller.signal }),
        controller.signal,
      );
      if (request !== generation.current.request) return;
      const module = response.modules.find(
        (item) => item.key === "family-tree",
      );
      setAccess({
        state: module ? "allowed" : "denied",
        manage: module?.can_manage === true,
        error: null,
        owner,
      });
    } catch (error) {
      if (request === generation.current.request)
        setAccess({
          state: "error",
          manage: false,
          error: formatApiError(error),
          owner,
        });
    }
  }, [owner]);
  useEffect(() => {
    const ownership = generation.current;
    const ownedDiscovery = discovery.current;
    void refresh();
    const check = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      ++ownership.request;
      ownedDiscovery.controller?.abort();
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [refresh]);
  useEffect(() => {
    const view = moduleKeys.includes("family-tree"),
      manage = manageableModuleKeys.includes("family-tree");
    if (previous.current.owner !== owner) {
      previous.current = { view, manage, owner };
      return;
    }
    if (previous.current.view && !view) {
      ++generation.current.request;
      discovery.current.controller?.abort();
      setAccess({ state: "denied", manage: false, error: null, owner });
    } else if (previous.current.manage && !manage) {
      ++generation.current.request;
      discovery.current.controller?.abort();
      setAccess((current) => ({ ...current, manage: false, checking: false }));
    }
    previous.current = { view, manage, owner };
  }, [moduleKeys, manageableModuleKeys, owner]);
  const revoke = useCallback(() => {
    if (activeOwner.current !== owner) return;
    ++generation.current.request;
    discovery.current.controller?.abort();
    setAccess({ state: "denied", manage: false, error: null, owner });
  }, [owner]);
  return {
    access:
      access.owner === owner
        ? access
        : ({
            state: owner ? "loading" : "denied",
            manage: false,
            error: null,
            owner,
          } as TreeAccess),
    refresh,
    revoke,
  };
}
