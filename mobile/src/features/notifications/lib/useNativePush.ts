import { useEffect, useRef, useState } from "react";
import { apiClient } from "../../../api/client";
import type { AuthSessionResponse, FamilyModule } from "../../../api/models";
import type { AppTab } from "../../../navigation/types";
import { NativePushController, type NativePushState } from "./nativePushController";
import { loadNativePushRuntime } from "./nativePushRuntime";
export interface NativePushBinding {
  state: NativePushState;
  enable(): void;
  disable(): void;
  refresh(): void;
}
const initial: NativePushState = {status: "loading", busy: false, hasRegistration: false, message: "Checking device notifications..."};
export function useNativePush(session: AuthSessionResponse | null, modules: FamilyModule[], onNavigate: (tab: AppTab) => void): NativePushBinding {
  const latest = useRef({session, modules, onNavigate});
  latest.current = {session, modules, onNavigate};
  const controller = useRef<NativePushController | null>(null);
  const [snapshot, setSnapshot] = useState<{actor: AuthSessionResponse; state: NativePushState} | null>(null);
  useEffect(() => {
    if (!session) return;
    let mounted = true;
    const current = () => mounted && latest.current.session === session;
    const owner = new NativePushController({ api: apiClient, session, modules: () => latest.current.modules, loadRuntime: loadNativePushRuntime,
      onState: state => { if (current()) setSnapshot({actor: session, state}); },
      onNavigate: tab => { if (current()) latest.current.onNavigate(tab); },
    });
    controller.current = owner;
    void owner.start();
    return () => { mounted = false; owner.dispose(); if (controller.current === owner) controller.current = null; };
  }, [session]);
  return {
    state: snapshot?.actor === session ? snapshot.state : initial,
    enable: () => { void controller.current?.enable(); },
    disable: () => { void controller.current?.disable(); },
    refresh: () => { void controller.current?.refresh(); },
  };
}
