import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, findNodeHandle, Pressable, Text, View } from "react-native";

import { apiClient } from "../../api/client";
import type {
  HouseholdModuleAccess,
  UserModuleAccess,
  UserRole,
} from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { useModuleAccess } from "../../modules/ModuleAccessContext";
import { familyModules, type FamilyModuleKey } from "../../modules/registry";
import { CreateParentPanel } from "../../features/admin/components/CreateParentPanel";
import { adminStyles } from "../../features/admin/styles";
import { cardStyles } from "../../styles/cards";
import { formStyles } from "../../styles/forms";
import { shellStyles } from "../../styles/shell";
import { formatError } from "../../utils/format";

type AdminState = {
  users: UserModuleAccess[];
  loading: boolean;
  error: string | null;
};

type HouseholdModuleState = {
  modules: HouseholdModuleAccess[];
  loading: boolean;
  error: string | null;
};

function hasModule(user: UserModuleAccess, moduleKey: FamilyModuleKey): boolean {
  return user.modules.some((module) => module.key === moduleKey);
}

function isLastAdminAccess(
  users: UserModuleAccess[],
  user: UserModuleAccess,
  moduleKey: FamilyModuleKey,
): boolean {
  if (moduleKey !== "admin" || !hasModule(user, "admin")) {
    return false;
  }
  return (
    users.filter(
      (row) => row.role === "PARENT_ADMIN" && hasModule(row, "admin"),
    ).length === 1
  );
}

export function AdminScreen({
  onModulesChanged,
}: {
  onModulesChanged?: () => void | Promise<void>;
}) {
  const [addingParent, setAddingParent] = useState(false);
  const addTrigger = useRef<View>(null);
  function closeParent() {
    if (creatingParent) return;
    setAddingParent(false);
    const target = findNodeHandle(addTrigger.current);
    if (target) AccessibilityInfo.setAccessibilityFocus(target);
  }
  const { canManage, canManageRef } = useModuleAccess();
  const [state, setState] = useState<AdminState>({
    users: [],
    loading: true,
    error: null,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [newParentEmail, setNewParentEmail] = useState("");
  const [newParentPassword, setNewParentPassword] = useState("");
  const [newParentRole, setNewParentRole] =
    useState<Extract<UserRole, "PARENT" | "PARENT_ADMIN">>("PARENT");
  const [creatingParent, setCreatingParent] = useState(false);
  const [updatingAccess, setUpdatingAccess] = useState<string | null>(null);
  const [householdState, setHouseholdState] = useState<HouseholdModuleState>({
    modules: [],
    loading: true,
    error: null,
  });
  const [updatingHouseholdModule, setUpdatingHouseholdModule] = useState<
    string | null
  >(null);
  const [householdActionError, setHouseholdActionError] = useState<{
    module: HouseholdModuleAccess;
    message: string;
  } | null>(null);
  const [householdActionMessage, setHouseholdActionMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!addingParent) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { closeParent(); return true; });
    return () => subscription.remove();
  }, [addingParent, creatingParent]);

  const refresh = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const users = await apiClient.listUserModuleAccess();
      setState({ users, loading: false, error: null });
    } catch (error) {
      setState({ users: [], loading: false, error: formatError(error) });
    }
  }, []);

  const refreshHouseholdModules = useCallback(async () => {
    setHouseholdState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));
    try {
      const modules = await apiClient.listHouseholdModules();
      setHouseholdState({ modules, loading: false, error: null });
    } catch (error) {
      setHouseholdState((previous) => ({
        ...previous,
        loading: false,
        error: formatError(error),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refreshHouseholdModules();
  }, [refreshHouseholdModules]);

  async function toggleHouseholdModule(module: HouseholdModuleAccess) {
    if (!canManageRef.current) return;
    if (!module.can_disable || updatingHouseholdModule !== null) {
      return;
    }

    const enabled = !module.enabled;
    setHouseholdActionError(null);
    setHouseholdActionMessage(null);
    setUpdatingHouseholdModule(module.key);
    try {
      const updated = await apiClient.setHouseholdModuleAccess(module.key, {
        enabled,
      });
      setHouseholdState((previous) => ({
        ...previous,
        modules: previous.modules.map((row) =>
          row.key === updated.key ? updated : row,
        ),
      }));
      setHouseholdActionMessage(
        `${updated.name} is now ${updated.enabled ? "enabled" : "disabled"} for the household.`,
      );
      try {
        await onModulesChanged?.();
      } catch (error) {
        setHouseholdActionError({
          module: updated,
          message: `The household setting was saved, but effective modules could not refresh: ${formatError(error)}`,
        });
      }
    } catch (error) {
      setHouseholdActionError({ module, message: formatError(error) });
    } finally {
      setUpdatingHouseholdModule(null);
    }
  }

  async function createParent() {
    if (!canManageRef.current) return;
    setActionError(null);
    setActionMessage(null);
    const email = newParentEmail.trim().toLowerCase();
    if (email.length < 3) {
      setActionError("Parent email is required.");
      return;
    }
    if (newParentPassword.length < 8) {
      setActionError("Parent password must be at least 8 characters.");
      return;
    }

    setCreatingParent(true);
    try {
      const created = await apiClient.createParentUser({
        email,
        password: newParentPassword,
        role: newParentRole,
      });
      setState((previous) => ({
        ...previous,
        users: [
          ...previous.users.filter((row) => row.id !== created.id),
          created,
        ].sort((a, b) => a.email.localeCompare(b.email)),
      }));
      setNewParentEmail("");
      setNewParentPassword("");
      setNewParentRole("PARENT");
      setAddingParent(false);
      setActionMessage(
        `Created ${created.role === "PARENT_ADMIN" ? "admin" : "parent"} login for ${created.email}.`,
      );
    } catch (error) {
      setActionError(formatError(error));
    } finally {
      setCreatingParent(false);
    }
  }

  async function toggleAccess(
    user: UserModuleAccess,
    moduleKey: FamilyModuleKey,
  ) {
    if (!canManageRef.current) return;
    setActionError(null);
    setActionMessage(null);
    const nextCanView = !hasModule(user, moduleKey);
    setUpdatingAccess(`${user.id}-${moduleKey}`);
    try {
      const updated = await apiClient.setUserModuleAccess(user.id, {
        module_key: moduleKey,
        can_view: nextCanView,
        can_manage: moduleKey === "admin" && nextCanView,
      });
      setState((previous) => ({
        ...previous,
        users: previous.users.map((row) =>
          row.id === updated.id ? updated : row,
        ),
      }));
      const nowEnabled = hasModule(updated, moduleKey);
      setActionMessage(
        `${updated.email} ${nowEnabled ? "can now access" : "cannot access"} ${moduleKey}.`,
      );
    } catch (error) {
      setActionError(formatError(error));
    } finally {
      setUpdatingAccess(null);
    }
  }

  return (
    <View>
      <ScreenHeader
        subtitle="Household modules, parent users, and access"
        title="Admin"
        trailing={
          <ActionButton
            compact
            disabled={state.loading || householdState.loading}
            label={state.loading || householdState.loading ? "Loading" : "Refresh"}
            onPress={() => {
              void Promise.all([refresh(), refreshHouseholdModules()]);
            }}
            variant="secondary"
          />
        }
      />
      <View ref={addTrigger}>
        <ActionButton label="Add Parent" requiresManage disabled={creatingParent} onPress={() => setAddingParent(true)} />
      </View>
      {addingParent ? (
        <CreateParentPanel
          email={newParentEmail}
          password={newParentPassword}
          role={newParentRole}
          creating={creatingParent}
          error={actionError}
          onClose={closeParent}
          onEmailChange={(value) => { setNewParentEmail(value); setActionError(null); setActionMessage(null); }}
          onPasswordChange={(value) => { setNewParentPassword(value); setActionError(null); setActionMessage(null); }}
          onRoleChange={setNewParentRole}
          onSubmit={createParent}
        />
      ) : null}
      <View style={addingParent ? { display: "none" } : undefined} accessibilityElementsHidden={addingParent} importantForAccessibility={addingParent ? "no-hide-descendants" : "auto"}>
      <SectionCard
        title="Household Modules"
        subtitle="These settings apply to everyone in your household. Individual access can still be managed below."
      >
        {householdState.loading ? (
          <LoadingRow label="Loading household modules" />
        ) : null}
        {!householdState.loading && householdState.error !== null ? (
          <>
            <InlineNotice
              tone="error"
              message={`Could not load household modules: ${householdState.error}`}
            />
            <ActionButton
              compact
              label="Retry household modules"
              onPress={refreshHouseholdModules}
              variant="secondary"
            />
          </>
        ) : null}
        {!householdState.loading &&
        householdState.error === null &&
        householdState.modules.length === 0 ? (
          <Text style={shellStyles.mutedText}>No household modules found.</Text>
        ) : null}
        {householdState.modules.map((module) => {
          const disabled =
            !canManage || !module.can_disable || updatingHouseholdModule !== null;
          return (
            <View key={module.key} style={formStyles.selectableRow}>
              <View style={formStyles.rowMain}>
                <Text style={formStyles.rowTitle}>{module.name}</Text>
                <Text style={formStyles.rowMeta}>{module.description}</Text>
                {!module.can_disable ? (
                  <Text style={adminStyles.lockedModuleText}>
                    Admin stays enabled so household administrators cannot be locked out.
                  </Text>
                ) : null}
                {householdActionError?.module.key === module.key ? (
                  <View style={adminStyles.moduleActionFeedback}>
                    <InlineNotice
                      tone="error"
                      message={`Could not update ${module.name}: ${householdActionError.message}`}
                    />
                    <ActionButton
                      compact
                      disabled={updatingHouseholdModule !== null}
                      label={`Retry ${module.name} update`}
                      requiresManage
                      onPress={() => toggleHouseholdModule(module)}
                      variant="secondary"
                    />
                  </View>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel={`${module.name} household access`}
                accessibilityHint={
                  module.can_disable
                    ? `Double tap to ${module.enabled ? "disable" : "enable"} ${module.name} for the household.`
                    : "Admin access is required and cannot be disabled."
                }
                accessibilityRole="switch"
                accessibilityState={{ checked: module.enabled, disabled }}
                disabled={disabled}
                onPress={() => toggleHouseholdModule(module)}
                style={[
                  adminStyles.moduleToggle,
                  module.enabled ? adminStyles.moduleToggleEnabled : null,
                  disabled && module.can_disable ? adminStyles.moduleToggleBusy : null,
                ]}
              >
                <View
                  style={[
                    adminStyles.moduleToggleThumb,
                    module.enabled ? adminStyles.moduleToggleThumbEnabled : null,
                  ]}
                />
                <Text style={adminStyles.moduleToggleLabel}>
                  {updatingHouseholdModule === module.key
                    ? "Saving"
                    : module.enabled
                      ? "On"
                      : "Off"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </SectionCard>

      {householdActionMessage !== null ? (
        <InlineNotice tone="success" message={householdActionMessage} />
      ) : null}


      {state.error !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not load module access: ${state.error}`}
        />
      ) : null}
      {actionError !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not update module access: ${actionError}`}
        />
      ) : null}
      {actionMessage !== null ? (
        <InlineNotice tone="success" message={actionMessage} />
      ) : null}

      <SectionCard title="Module Access" subtitle="Individual user access: each control affects only the named person. Household module settings take priority.">
        {state.loading ? <LoadingRow label="Loading module access" /> : null}
        {!state.loading && state.users.length === 0 ? (
          <Text style={shellStyles.mutedText}>No users found.</Text>
        ) : null}
        {state.users.map((user) => (
          <View key={user.id} style={cardStyles.reviewItem}>
            <Text style={formStyles.rowTitle}>{user.email}</Text>
            <Text style={formStyles.rowMeta}>
              {user.role}
              {user.child_id ? ` · child ${user.child_id}` : ""}
            </Text>
            <View style={formStyles.choiceGrid}>
              {familyModules.map((module) => {
                const enabled = hasModule(user, module.key);
                const householdStateUnavailable =
                  householdState.loading || householdState.error !== null;
                const globallyDisabled = householdState.modules.some(
                  (row) => row.key === module.key && !row.enabled,
                );
                const disabled =
                  !canManage ||
                  updatingAccess !== null ||
                  householdStateUnavailable ||
                  globallyDisabled ||
                  isLastAdminAccess(state.users, user, module.key);
                return (
                  <Pressable
                    accessibilityLabel={`${householdStateUnavailable ? "Household State Unavailable" : globallyDisabled ? "Globally Off" : enabled ? "On" : "Off"} ${module.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected: enabled }}
                    disabled={disabled}
                    key={module.key}
                    onPress={() => toggleAccess(user, module.key)}
                    style={[
                      formStyles.choiceButton,
                      enabled ? formStyles.choiceButtonSelected : null,
                      disabled ? formStyles.buttonDisabled : null,
                    ]}
                  >
                    <Text
                      style={[
                        formStyles.choiceButtonText,
                        enabled ? formStyles.choiceButtonTextSelected : null,
                      ]}
                    >
                      {householdStateUnavailable
                        ? "Household State Unavailable"
                        : globallyDisabled
                          ? "Globally Off"
                          : enabled
                            ? "On"
                            : "Off"} {module.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </SectionCard>
      </View>
    </View>
  );
}
