import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { FieldLabel } from "../../components/FieldLabel";
import { InlineNotice } from "../../components/InlineNotice";
import { SafeAreaScreen } from "../../components/SafeAreaScreen";
import type {
  ChildLoginInput,
  ParentLoginInput,
} from "../../hooks/useSessionBootstrap";
import { authStyles } from "../../features/auth/styles";
import { formStyles } from "../../styles/forms";
import { formatError } from "../../utils/format";

type LoginMode = "parent" | "child";

// Keep recovery in the hardened browser route: native apps never receive or
// retain reset capabilities, and the endpoint is intentionally not configurable.
const PARENT_PASSWORD_RECOVERY_URL = "https://family.multihost.ing/chore/forgot-password";

export function LoginScreen({
  apiBaseUrl,
  bootstrapError,
  onChildLogin,
  onParentLogin,
}: {
  apiBaseUrl: string;
  bootstrapError: string | null;
  onChildLogin: (input: ChildLoginInput) => Promise<void>;
  onParentLogin: (input: ParentLoginInput) => Promise<void>;
}) {
  const [mode, setMode] = useState<LoginMode>("parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childParentEmail, setChildParentEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(bootstrapError);

  useEffect(() => {
    setError(bootstrapError);
  }, [bootstrapError]);

  async function submitLogin() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "parent") {
        await onParentLogin({ email, password });
        setPassword("");
      } else {
        await onChildLogin({
          parentEmail: childParentEmail,
          childName,
          password: childPassword,
        });
        setChildPassword("");
      }
    } catch (loginError) {
      setError(`Could not sign in: ${formatError(loginError)}`);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    mode === "parent"
      ? email.trim().length > 0 && password.length > 0 && !loading
      : childParentEmail.trim().length > 0 &&
        childName.trim().length > 0 &&
        childPassword.length > 0 &&
        !loading;

  return (
    <SafeAreaScreen>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={authStyles.loginContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={authStyles.loginCard}>
          <Text style={authStyles.loginTitle}>Family Manager</Text>
          <Text style={authStyles.loginSubtitle}>
            Parents use their login email and password. Kids can use a parent
            login email, their child name, and their child password.
          </Text>
          <View style={authStyles.loginModeSwitch}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === "parent" }}
              disabled={loading}
              onPress={() => {
                setMode("parent");
                setError(null);
              }}
              style={[
                authStyles.loginModeButton,
                mode === "parent" ? authStyles.loginModeButtonActive : null,
              ]}
            >
              <Text
                style={[
                  authStyles.loginModeButtonText,
                  mode === "parent" ? authStyles.loginModeButtonTextActive : null,
                ]}
              >
                Parent
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === "child" }}
              disabled={loading}
              onPress={() => {
                setMode("child");
                setError(null);
              }}
              style={[
                authStyles.loginModeButton,
                mode === "child" ? authStyles.loginModeButtonActive : null,
              ]}
            >
              <Text
                style={[
                  authStyles.loginModeButtonText,
                  mode === "child" ? authStyles.loginModeButtonTextActive : null,
                ]}
              >
                Child
              </Text>
            </Pressable>
          </View>
          <View style={authStyles.apiBasePanel}>
            <Text style={authStyles.apiBaseLabel}>API</Text>
            <Text style={authStyles.apiBaseValue} numberOfLines={2}>
              {apiBaseUrl}
            </Text>
          </View>
          {mode === "parent" ? (
            <>
              <FieldLabel label="Login Email" />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={(value) => {
                  setEmail(value);
                  setError(null);
                }}
                placeholder="parent@example.com"
                placeholderTextColor="#94a3b8"
                style={formStyles.input}
                textContentType="emailAddress"
                value={email}
              />
              <FieldLabel label="Password" />
              <TextInput
                onChangeText={(value) => {
                  setPassword(value);
                  setError(null);
                }}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                style={formStyles.input}
                textContentType="password"
                value={password}
              />
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={() => {
                  void Linking.openURL(PARENT_PASSWORD_RECOVERY_URL);
                }}
                style={({ pressed }) => [
                  authStyles.recoveryLink,
                  pressed ? authStyles.recoveryLinkPressed : null,
                ]}
              >
                <Text style={authStyles.recoveryLinkText}>Forgot password?</Text>
              </Pressable>
            </>
          ) : (
            <>
              <FieldLabel label="Parent Login Email" />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={(value) => {
                  setChildParentEmail(value);
                  setError(null);
                }}
                placeholder="parent@example.com"
                placeholderTextColor="#94a3b8"
                style={formStyles.input}
                textContentType="emailAddress"
                value={childParentEmail}
              />
              <FieldLabel label="Child Name" />
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={(value) => {
                  setChildName(value);
                  setError(null);
                }}
                placeholder="Enter child name"
                placeholderTextColor="#94a3b8"
                style={formStyles.input}
                textContentType="username"
                value={childName}
              />
              <Text style={authStyles.recoveryGuidance}>
                Ask a parent for help resetting your password.
              </Text>
              <FieldLabel label="Child Password" />
              <TextInput
                onChangeText={(value) => {
                  setChildPassword(value);
                  setError(null);
                }}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                style={formStyles.input}
                textContentType="password"
                value={childPassword}
              />
            </>
          )}
          {error !== null ? (
            <InlineNotice tone="error" message={error} />
          ) : null}
          <ActionButton
            disabled={!canSubmit}
            label={loading ? "Signing in..." : "Sign in"}
            onPress={submitLogin}
          />
        </View>
      </ScrollView>
    </SafeAreaScreen>
  );
}
