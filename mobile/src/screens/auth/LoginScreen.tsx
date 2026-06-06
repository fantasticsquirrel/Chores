import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { FieldLabel } from "../../components/FieldLabel";
import { InlineNotice } from "../../components/InlineNotice";
import type {
  ChildLoginInput,
  ParentLoginInput,
} from "../../hooks/useSessionBootstrap";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";

type LoginMode = "parent" | "child";

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.loginContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Family Manager</Text>
          <Text style={styles.loginSubtitle}>
            Parents use their login email and password. Kids can use a parent
            login email, their child name, and their child password.
          </Text>
          <View style={styles.loginModeSwitch}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === "parent" }}
              disabled={loading}
              onPress={() => {
                setMode("parent");
                setError(null);
              }}
              style={[
                styles.loginModeButton,
                mode === "parent" ? styles.loginModeButtonActive : null,
              ]}
            >
              <Text
                style={[
                  styles.loginModeButtonText,
                  mode === "parent" ? styles.loginModeButtonTextActive : null,
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
                styles.loginModeButton,
                mode === "child" ? styles.loginModeButtonActive : null,
              ]}
            >
              <Text
                style={[
                  styles.loginModeButtonText,
                  mode === "child" ? styles.loginModeButtonTextActive : null,
                ]}
              >
                Child
              </Text>
            </Pressable>
          </View>
          <View style={styles.apiBasePanel}>
            <Text style={styles.apiBaseLabel}>API</Text>
            <Text style={styles.apiBaseValue} numberOfLines={2}>
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
                style={styles.input}
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
                style={styles.input}
                textContentType="password"
                value={password}
              />
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
                style={styles.input}
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
                placeholder="Ava"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                textContentType="username"
                value={childName}
              />
              <FieldLabel label="Child Password" />
              <TextInput
                onChangeText={(value) => {
                  setChildPassword(value);
                  setError(null);
                }}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                style={styles.input}
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
    </SafeAreaView>
  );
}
