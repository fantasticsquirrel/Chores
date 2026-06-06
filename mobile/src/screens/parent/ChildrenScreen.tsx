import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse, Child } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { FieldLabel } from "../../components/FieldLabel";
import { InlineNotice } from "../../components/InlineNotice";
import { LoadingRow } from "../../components/LoadingRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";

type ChildrenState = {
  children: Child[];
  loading: boolean;
  error: string | null;
};

export function ChildrenScreen({ session }: { session: AuthSessionResponse }) {
  const householdId = session.user.household_id;
  const [state, setState] = useState<ChildrenState>({
    children: [],
    loading: true,
    error: null,
  });
  const [nameInput, setNameInput] = useState("");
  const [activeOnCreate, setActiveOnCreate] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingChildId, setUpdatingChildId] = useState<number | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [childEmail, setChildEmail] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [linkAccountError, setLinkAccountError] = useState<string | null>(null);
  const [linkAccountSuccess, setLinkAccountSuccess] = useState<string | null>(
    null,
  );
  const [resetEmailInput, setResetEmailInput] = useState("");
  const [resettingEmail, setResettingEmail] = useState(false);
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);
  const [resetEmailSuccess, setResetEmailSuccess] = useState<string | null>(
    null,
  );
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(
    null,
  );
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<
    string | null
  >(null);

  const loadChildren = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const children = await apiClient.listChildren({
        household_id: householdId,
      });
      setState({ children, loading: false, error: null });
      if (children.length > 0) {
        setSelectedChildId((current) => current ?? children[0].id);
      }
    } catch (error) {
      setState({ children: [], loading: false, error: formatError(error) });
    }
  }, [householdId]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  async function createChild() {
    const trimmedName = nameInput.trim();
    if (trimmedName.length === 0) {
      setSubmitSuccess(null);
      setSubmitError("Child name is required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      await apiClient.createChild({
        household_id: householdId,
        name: trimmedName,
        active: activeOnCreate,
      });
      setNameInput("");
      setActiveOnCreate(true);
      setSubmitSuccess("Child created.");
      await loadChildren();
    } catch (error) {
      setSubmitError(`Could not save child: ${formatError(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(child: Child) {
    setUpdatingChildId(child.id);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      await apiClient.updateChild(child.id, {
        household_id: householdId,
        active: !child.active,
      });
      setSubmitSuccess(
        `${child.name} is now ${child.active ? "inactive" : "active"}.`,
      );
      await loadChildren();
    } catch (error) {
      setSubmitError(`Could not save child: ${formatError(error)}`);
    } finally {
      setUpdatingChildId(null);
    }
  }

  async function createChildAccount() {
    setLinkAccountError(null);
    setLinkAccountSuccess(null);
    if (selectedChildId === null) {
      setLinkAccountError("Choose a child first.");
      return;
    }
    if (childEmail.trim().length > 0 && childEmail.trim().length < 3) {
      setLinkAccountError("If provided, email must be at least 3 characters.");
      return;
    }
    if (childPassword.length < 8) {
      setLinkAccountError("Password must be at least 8 characters.");
      return;
    }

    setLinkingAccount(true);
    try {
      const normalizedEmail = childEmail.trim().toLowerCase();
      const account = await apiClient.createChildAccount(selectedChildId, {
        household_id: householdId,
        email: normalizedEmail.length > 0 ? normalizedEmail : null,
        password: childPassword,
      });
      const childName =
        state.children.find((child) => child.id === selectedChildId)?.name ??
        "child";
      setLinkAccountSuccess(
        `Linked login created for ${childName}. Child can sign in with a parent login email, ${childName}, and the child password. Legacy email ${account.email} still works for email/password sign-in.`,
      );
      setChildEmail("");
      setChildPassword("");
    } catch (error) {
      setLinkAccountError(`Could not link child login: ${formatError(error)}`);
    } finally {
      setLinkingAccount(false);
    }
  }

  async function resetChildEmail() {
    setResetEmailError(null);
    setResetEmailSuccess(null);
    if (selectedChildId === null) {
      setResetEmailError("Choose a child first.");
      return;
    }

    setResettingEmail(true);
    try {
      const normalizedEmail = resetEmailInput.trim().toLowerCase();
      const account = await apiClient.resetChildAccountEmail(selectedChildId, {
        household_id: householdId,
        email: normalizedEmail.length > 0 ? normalizedEmail : null,
      });
      const childName =
        state.children.find((child) => child.id === selectedChildId)?.name ??
        "child";
      setResetEmailSuccess(
        `Updated legacy login email for ${childName}. Parent email + child name + child password is recommended; ${account.email} still works for email/password sign-in.`,
      );
      setResetEmailInput("");
    } catch (error) {
      setResetEmailError(`Could not reset child email: ${formatError(error)}`);
    } finally {
      setResettingEmail(false);
    }
  }

  async function resetChildPassword() {
    setResetPasswordError(null);
    setResetPasswordSuccess(null);
    if (selectedChildId === null) {
      setResetPasswordError("Choose a child first.");
      return;
    }
    if (resetPasswordInput.length < 8) {
      setResetPasswordError(
        "Temporary password must be at least 8 characters.",
      );
      return;
    }
    if (resetPasswordInput !== resetPasswordConfirm) {
      setResetPasswordError("Temporary password and confirmation must match.");
      return;
    }

    setResettingPassword(true);
    try {
      const account = await apiClient.resetChildAccountPassword(
        selectedChildId,
        {
          household_id: householdId,
          new_password: resetPasswordInput,
        },
      );
      const childName =
        state.children.find((child) => child.id === selectedChildId)?.name ??
        "child";
      setResetPasswordSuccess(
        `Updated password for ${childName}. Child can sign in with a parent login email, ${childName}, and the new child password. Legacy email ${account.email} still works.`,
      );
      setResetPasswordInput("");
      setResetPasswordConfirm("");
    } catch (error) {
      setResetPasswordError(
        `Could not reset child password: ${formatError(error)}`,
      );
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <View>
      <ScreenHeader
        subtitle="Profiles and child-friendly login credentials"
        title="Children"
        trailing={
          <ActionButton
            compact
            disabled={state.loading}
            label={state.loading ? "Loading" : "Refresh"}
            onPress={loadChildren}
            variant="secondary"
          />
        }
      />
      <SectionCard title="Add Child">
        <FieldLabel label="Name" />
        <TextInput
          maxLength={255}
          onChangeText={(value) => {
            setNameInput(value);
            setSubmitError(null);
            setSubmitSuccess(null);
          }}
          placeholder="Avery"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={nameInput}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveOnCreate((current) => !current)}
          style={[
            styles.selectableRow,
            activeOnCreate ? styles.selectableRowSelected : null,
          ]}
        >
          <Text style={styles.rowTitle}>Active on create</Text>
          <Text
            style={[
              styles.selectionMark,
              activeOnCreate ? styles.selectionMarkSelected : null,
            ]}
          >
            {activeOnCreate ? "Yes" : "No"}
          </Text>
        </Pressable>
        <ActionButton
          disabled={submitting}
          label={submitting ? "Saving..." : "Create Child"}
          onPress={createChild}
        />
      </SectionCard>

      {submitError !== null ? (
        <InlineNotice tone="error" message={submitError} />
      ) : null}
      {submitSuccess !== null ? (
        <InlineNotice tone="success" message={submitSuccess} />
      ) : null}

      <SectionCard title="Select Child">
        {state.loading ? <LoadingRow label="Loading children" /> : null}
        {!state.loading && state.error !== null ? (
          <InlineNotice
            tone="error"
            message={`Could not load children: ${state.error}`}
          />
        ) : null}
        {!state.loading && state.children.length === 0 ? (
          <Text style={styles.mutedText}>No children found yet.</Text>
        ) : null}
        <View>
          {state.children.map((child) => (
            <Pressable
              accessibilityRole="button"
              key={child.id}
              onPress={() => setSelectedChildId(child.id)}
              style={[
                styles.selectableRow,
                selectedChildId === child.id
                  ? styles.selectableRowSelected
                  : null,
              ]}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{child.name}</Text>
                <Text style={styles.rowMeta}>
                  {child.active ? "Active" : "Inactive"}
                </Text>
              </View>
              <Text
                style={[
                  styles.selectionMark,
                  selectedChildId === child.id
                    ? styles.selectionMarkSelected
                    : null,
                ]}
              >
                {selectedChildId === child.id ? "Selected" : "Select"}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard
        subtitle="Kids can sign in with parent email, child name, and child password. Legacy child emails still work."
        title="Child Login"
      >
        <FieldLabel label="Legacy Login Email (optional, blank auto-generates)" />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(value) => {
            setChildEmail(value);
            setLinkAccountError(null);
            setLinkAccountSuccess(null);
          }}
          placeholder="kid@example.com"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={childEmail}
        />
        <FieldLabel label="Temporary Password" />
        <TextInput
          onChangeText={(value) => {
            setChildPassword(value);
            setLinkAccountError(null);
            setLinkAccountSuccess(null);
          }}
          placeholder="At least 8 characters"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          value={childPassword}
        />
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={linkingAccount || state.children.length === 0}
            label={linkingAccount ? "Linking..." : "Create Login"}
            onPress={createChildAccount}
          />
        </View>
        {linkAccountError !== null ? (
          <InlineNotice tone="error" message={linkAccountError} />
        ) : null}
        {linkAccountSuccess !== null ? (
          <InlineNotice tone="success" message={linkAccountSuccess} />
        ) : null}
      </SectionCard>

      <SectionCard
        subtitle="Leave blank to generate a new internal legacy email."
        title="Reset Legacy Login Email"
      >
        <FieldLabel label="New Legacy Login Email (optional)" />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(value) => {
            setResetEmailInput(value);
            setResetEmailError(null);
            setResetEmailSuccess(null);
          }}
          placeholder="Leave blank to auto-generate"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={resetEmailInput}
        />
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={resettingEmail || state.children.length === 0}
            label={resettingEmail ? "Resetting..." : "Reset Email"}
            onPress={resetChildEmail}
            variant="secondary"
          />
        </View>
        {resetEmailError !== null ? (
          <InlineNotice tone="error" message={resetEmailError} />
        ) : null}
        {resetEmailSuccess !== null ? (
          <InlineNotice tone="success" message={resetEmailSuccess} />
        ) : null}
      </SectionCard>

      <SectionCard
        subtitle="Sets a temporary password for the selected child account."
        title="Reset Child Password"
      >
        <FieldLabel label="New Temporary Password" />
        <TextInput
          onChangeText={(value) => {
            setResetPasswordInput(value);
            setResetPasswordError(null);
            setResetPasswordSuccess(null);
          }}
          placeholder="At least 8 characters"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          textContentType="newPassword"
          value={resetPasswordInput}
        />
        <FieldLabel label="Confirm Temporary Password" />
        <TextInput
          onChangeText={(value) => {
            setResetPasswordConfirm(value);
            setResetPasswordError(null);
            setResetPasswordSuccess(null);
          }}
          placeholder="Repeat temporary password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          textContentType="newPassword"
          value={resetPasswordConfirm}
        />
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={resettingPassword || state.children.length === 0}
            label={resettingPassword ? "Resetting..." : "Reset Password"}
            onPress={resetChildPassword}
            variant="secondary"
          />
        </View>
        {resetPasswordError !== null ? (
          <InlineNotice tone="error" message={resetPasswordError} />
        ) : null}
        {resetPasswordSuccess !== null ? (
          <InlineNotice tone="success" message={resetPasswordSuccess} />
        ) : null}
      </SectionCard>

      <SectionCard title="Children">
        {state.children.map((child) => {
          const isUpdating = updatingChildId === child.id;
          return (
            <View key={child.id} style={styles.reviewItem}>
              <View style={styles.splitRow}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{child.name}</Text>
                  <Text style={styles.rowMeta}>
                    {child.active ? "Active" : "Inactive"}
                  </Text>
                </View>
                <ActionButton
                  compact
                  disabled={isUpdating}
                  label={
                    isUpdating
                      ? "Updating"
                      : child.active
                        ? "Set Inactive"
                        : "Set Active"
                  }
                  onPress={() => toggleActive(child)}
                  variant={child.active ? "danger" : "secondary"}
                />
              </View>
            </View>
          );
        })}
      </SectionCard>
    </View>
  );
}
