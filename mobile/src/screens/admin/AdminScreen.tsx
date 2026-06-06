import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { apiClient } from "../../api/client";
import type { UserModuleAccess, UserRole } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FieldLabel } from "../../components/FieldLabel";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { familyModules, type FamilyModuleKey } from "../../modules/registry";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";

type AdminState = {
  users: UserModuleAccess[];
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

export function AdminScreen() {
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

  const refresh = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const users = await apiClient.listUserModuleAccess();
      setState({ users, loading: false, error: null });
    } catch (error) {
      setState({ users: [], loading: false, error: formatError(error) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createParent() {
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
      setActionMessage(
        `${updated.email} ${nextCanView ? "can now access" : "lost access to"} ${moduleKey}.`,
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
        subtitle="Parent users and module access"
        title="Admin"
        trailing={
          <ActionButton
            compact
            disabled={state.loading}
            label={state.loading ? "Loading" : "Refresh"}
            onPress={refresh}
            variant="secondary"
          />
        }
      />
      <SectionCard title="Add Parent Login">
        <FieldLabel label="Email" />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(value) => {
            setNewParentEmail(value);
            setActionError(null);
            setActionMessage(null);
          }}
          placeholder="other.parent@example.com"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={newParentEmail}
        />
        <FieldLabel label="Temporary Password" />
        <TextInput
          onChangeText={(value) => {
            setNewParentPassword(value);
            setActionError(null);
            setActionMessage(null);
          }}
          placeholder="At least 8 characters"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          value={newParentPassword}
        />
        <FieldLabel label="Role" />
        <ChoiceGroup
          disabled={creatingParent}
          onChange={setNewParentRole}
          options={[
            { label: "Parent", value: "PARENT" },
            { label: "Parent Admin", value: "PARENT_ADMIN" },
          ]}
          value={newParentRole}
        />
        <ActionButton
          disabled={creatingParent}
          label={creatingParent ? "Creating..." : "Create Parent Login"}
          onPress={createParent}
        />
      </SectionCard>

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

      <SectionCard title="Module Access">
        {state.loading ? <LoadingRow label="Loading module access" /> : null}
        {!state.loading && state.users.length === 0 ? (
          <Text style={styles.mutedText}>No users found.</Text>
        ) : null}
        {state.users.map((user) => (
          <View key={user.id} style={styles.reviewItem}>
            <Text style={styles.rowTitle}>{user.email}</Text>
            <Text style={styles.rowMeta}>
              {user.role}
              {user.child_id ? ` · child ${user.child_id}` : ""}
            </Text>
            <View style={styles.choiceGrid}>
              {familyModules.map((module) => {
                const enabled = hasModule(user, module.key);
                const disabled =
                  updatingAccess !== null ||
                  isLastAdminAccess(state.users, user, module.key);
                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={disabled}
                    key={module.key}
                    onPress={() => toggleAccess(user, module.key)}
                    style={[
                      styles.choiceButton,
                      enabled ? styles.choiceButtonSelected : null,
                      disabled ? styles.buttonDisabled : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceButtonText,
                        enabled ? styles.choiceButtonTextSelected : null,
                      ]}
                    >
                      {enabled ? "On" : "Off"} {module.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}
