import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Text,
  View,
} from "react-native";
import type { AuthSessionResponse, FamilyModule } from "../api/models";
import type {
  DiscoveryChild,
  DiscoveryChildAccess,
  DiscoveryExploration,
} from "@family-manager/family-api/models/discovery-lab";
import { apiClient } from "../api/client";
import { ActionButton } from "../components/ActionButton";
import { SectionCard } from "../components/SectionCard";
import { colors } from "../styles/colors";
import {
  DiscoveryFilters,
  emptyFilters,
  matches,
} from "../features/discovery-lab/components/DiscoveryFilters";
import { ExplorationDetail } from "../features/discovery-lab/components/ExplorationDetail";

type Props = { session: AuthSessionResponse; modules: FamilyModule[] };
export function DiscoveryLabScreen({ session, modules }: Props) {
  const grant = modules.find((m) => m.key === "discovery-lab");
  if (!grant)
    return (
      <Text style={{ color: colors.text }}>
        Discovery Lab is not enabled for this account.
      </Text>
    );
  return (
    <Lab
      key={`${session.user.household_id}:${session.user.id}:${session.user.role}:${grant.can_manage}`}
      parent={session.user.role !== "CHILD"}
      canManage={grant.can_manage === true}
    />
  );
}
function Lab({ parent, canManage }: { parent: boolean; canManage: boolean }) {
  const [items, setItems] = useState<DiscoveryExploration[]>([]),
    [children, setChildren] = useState<DiscoveryChild[]>([]);
  const [childId, setChildId] = useState<number | null>(null),
    [access, setAccess] = useState<DiscoveryChildAccess | null>(null);
  const [detail, setDetail] = useState<DiscoveryExploration | null>(null),
    [manage, setManage] = useState(false);
  const [filters, setFilters] = useState(emptyFilters),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const epoch = useRef(0),
    alive = useRef(true),
    lock = useRef(false);
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Could not load Discovery Lab.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function load() {
    const ticket = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const [result, resultChildren] = await Promise.all([
        apiClient.listDiscoveryExplorations(),
        parent && canManage
          ? apiClient.listDiscoveryChildren()
          : Promise.resolve([]),
      ]);
      if (alive.current && ticket === epoch.current) {
        setItems(result);
        setChildren(resultChildren);
      }
    } catch (e) {
      if (alive.current && ticket === epoch.current)
        setError(
          e instanceof Error ? e.message : "Could not load Discovery Lab.",
        );
    } finally {
      if (alive.current && ticket === epoch.current) setBusy(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      epoch.current++;
    };
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" && !lock.current) {
        setDetail(null);
        setAccess(null);
        setManage(false);
        void load();
      }
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (detail) {
        setDetail(null);
        return true;
      }
      if (manage) {
        setManage(false);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [detail, manage]);
  async function open(id: string) {
    if (lock.current) return;
    const ticket = ++epoch.current;
    await run(async () => {
      const result = await apiClient.getDiscoveryExploration(id);
      if (alive.current && ticket === epoch.current) setDetail(result);
    });
  }
  async function selectChild(id: number) {
    if (lock.current) return;
    setAccess(null);
    setChildId(id);
    const ticket = ++epoch.current;
    await run(async () => {
      const result = await apiClient.getDiscoveryChildAccess(id);
      if (alive.current && ticket === epoch.current) setAccess(result);
    });
  }
  async function update(ids: string[], enabled: boolean) {
    if (lock.current) return;
    if (childId === null || !ids.length) return;
    const id = childId,
      ticket = ++epoch.current;
    const packageVersions = Object.fromEntries(
      (access?.explorations ?? [])
        .filter((entry) => ids.includes(entry.id) && entry.package)
        .map((entry) => [entry.id, entry.package!.version]),
    );
    await run(async () => {
      const result = await apiClient.updateDiscoveryChildAccess(id, {
        enabled,
        exploration_ids: ids,
        ...(enabled && Object.keys(packageVersions).length
          ? { package_versions: packageVersions }
          : {}),
      });
      if (alive.current && ticket === epoch.current) {
        setAccess(result);
        setNotice(
          `${ids.length} Exploration${ids.length === 1 ? "" : "s"} ${enabled ? "enabled" : "disabled"}.`,
        );
      }
    });
  }
  const source = manage ? (access?.explorations ?? []) : items,
    matched = source.filter((i) => matches(i, filters));
  return (
    <View style={{ gap: 16 }}>
      <SectionCard
        title="Discovery Lab"
        subtitle="Science, mathematics, and history"
      >
        <Text style={{ color: colors.text, lineHeight: 22 }}>
          Choose a model, predict a result, and test your explanation.
        </Text>
      </SectionCard>
      {busy ? (
        <ActivityIndicator accessibilityLabel="Loading Discovery Lab" />
      ) : null}
      {error ? (
        <View>
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {error}
          </Text>
          <ActionButton
            disabled={busy}
            label="Retry"
            onPress={() => {
              if (manage && childId !== null) void selectChild(childId);
              else void load();
            }}
          />
        </View>
      ) : null}
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.successText }}
        >
          {notice}
        </Text>
      ) : null}
      {detail ? (
        <>
          <ActionButton
            label="Back to Explorations"
            disabled={busy}
            variant="secondary"
            onPress={() => setDetail(null)}
          />
          <ExplorationDetail detail={detail} />
        </>
      ) : (
        <>
          {parent && canManage ? (
            <ActionButton
              disabled={busy}
              label={manage ? "Browse Explorations" : "Manage child access"}
              variant="secondary"
              onPress={() => {
                setManage(!manage);
                setFilters(emptyFilters);
                setError("");
              }}
            />
          ) : null}
          {manage ? (
            <SectionCard title="Choose a child">
              <Text style={{ color: colors.textMuted }}>
                Changes apply only to the selected child. Bundled Explorations
                are enabled by default within an enabled module. Published
                packages require approval for each version and run in the web
                app. The latest individual or group change wins; other pages
                stay unchanged.
              </Text>
              {children.length === 0 && !busy ? (
                <Text style={{ color: colors.text }}>
                  No children available.
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {children.map((child) => (
                  <ActionButton
                    key={child.id}
                    disabled={busy}
                    label={child.name}
                    variant={childId === child.id ? "primary" : "secondary"}
                    onPress={() => void selectChild(child.id)}
                  />
                ))}
              </View>
            </SectionCard>
          ) : null}
          {!manage || access ? (
            <>
              <SectionCard title="Find an Exploration">
                <DiscoveryFilters
                  items={source}
                  value={filters}
                  onChange={setFilters}
                />
                <Text style={{ color: colors.text }}>
                  {matched.length} matching Exploration
                  {matched.length === 1 ? "" : "s"}
                </Text>
              </SectionCard>
              {manage ? (
                <View style={{ gap: 8 }}>
                  <ActionButton
                    label={`Enable ${matched.length} matching Explorations`}
                    disabled={busy || !matched.length}
                    onPress={() =>
                      void update(
                        matched.map((i) => i.id),
                        true,
                      )
                    }
                  />
                  <ActionButton
                    label={`Disable ${matched.length} matching Explorations`}
                    disabled={busy || !matched.length}
                    variant="secondary"
                    onPress={() =>
                      void update(
                        matched.map((i) => i.id),
                        false,
                      )
                    }
                  />
                </View>
              ) : null}
              {!matched.length && !busy ? (
                <Text style={{ color: colors.text }}>
                  No Explorations match. Try resetting filters
                  {manage
                    ? ""
                    : ", or ask a parent to enable more Explorations"}
                  .
                </Text>
              ) : null}
              {matched.map((item) => (
                <SectionCard
                  key={item.id}
                  title={item.title}
                  subtitle={`${item.subject} · ${item.grade_bands.join(", ")}`}
                >
                  <Text style={{ color: colors.text, lineHeight: 22 }}>
                    {item.summary}
                  </Text>
                  <Text style={{ color: colors.textMuted }}>
                    {item.tags.join(" · ")}
                    {item.package
                      ? ` · Web-only Exploration · Version ${item.package.version}`
                      : ""}
                  </Text>
                  {manage ? (
                    <ActionButton
                      disabled={busy}
                      label={`${"enabled" in item && item.enabled ? "Disable" : "Enable"} ${item.title}`}
                      variant="secondary"
                      onPress={() =>
                        void update(
                          [item.id],
                          !("enabled" in item && item.enabled),
                        )
                      }
                    />
                  ) : (
                    <ActionButton
                      label={`Explore ${item.title}`}
                      disabled={busy}
                      onPress={() => void open(item.id)}
                    />
                  )}
                </SectionCard>
              ))}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}
