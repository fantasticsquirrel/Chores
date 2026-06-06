import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { FieldLabel } from "../../components/FieldLabel";
import { InlineNotice } from "../../components/InlineNotice";
import { styles } from "../../styles/layout";
import { formatError } from "../../utils/format";

export function LoginScreen({
  apiBaseUrl,
  bootstrapError,
  onLogin,
}: {
  apiBaseUrl: string;
  bootstrapError: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(bootstrapError);

  useEffect(() => {
    setError(bootstrapError);
  }, [bootstrapError]);

  async function submitLogin() {
    setLoading(true);
    setError(null);
    try {
      await onLogin(email, password);
      setPassword("");
    } catch (loginError) {
      setError(`Could not sign in: ${formatError(loginError)}`);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

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
            Sign in with a parent or child login email, not a child display
            name.
          </Text>
          <View style={styles.apiBasePanel}>
            <Text style={styles.apiBaseLabel}>API</Text>
            <Text style={styles.apiBaseValue} numberOfLines={2}>
              {apiBaseUrl}
            </Text>
          </View>
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
