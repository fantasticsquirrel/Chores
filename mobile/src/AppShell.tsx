import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { apiClient } from "./api/client";
import { InlineNotice } from "./components/InlineNotice";
import { useModules } from "./hooks/useModules";
import { useSessionBootstrap } from "./hooks/useSessionBootstrap";
import { buildTabs, defaultTabForRole } from "./navigation/tabs";
import { AccountScreen } from "./screens/account/AccountScreen";
import { AdminScreen } from "./screens/admin/AdminScreen";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { ChildTodayScreen } from "./screens/child/ChildTodayScreen";
import { HomeschoolScreen } from "./screens/homeschool/HomeschoolScreen";
import { ChildrenScreen } from "./screens/parent/ChildrenScreen";
import { ChoresScreen } from "./screens/parent/ChoresScreen";
import { ParentHomeScreen } from "./screens/parent/ParentHomeScreen";
import { ParentReviewScreen } from "./screens/parent/ReviewScreen";
import { styles } from "./styles/layout";
import { isParentRole } from "./utils/format";

export function AppShell() {
  const { loadModules, modules, setModules } = useModules();
  const {
    activeTab,
    bootstrapping,
    bootstrapError,
    handleChildLogin,
    handleLogout,
    handleParentLogin,
    session,
    setActiveTab,
  } = useSessionBootstrap({ loadModules, setModules });

  const tabs = useMemo(
    () => (session === null ? [] : buildTabs(session.user.role, modules)),
    [modules, session],
  );

  useEffect(() => {
    if (session === null || tabs.length === 0) {
      return;
    }
    if (!tabs.some((tab) => tab.key === activeTab)) {
      const defaultTab = defaultTabForRole(session.user.role);
      setActiveTab(
        tabs.some((tab) => tab.key === defaultTab) ? defaultTab : tabs[0].key,
      );
    }
  }, [activeTab, session, setActiveTab, tabs]);

  if (bootstrapping) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.centeredPanel}>
          <ActivityIndicator color="#0f766e" size="large" />
          <Text style={styles.mutedText}>Opening Family Manager</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (session === null) {
    return (
      <LoginScreen
        apiBaseUrl={apiClient.apiBaseUrl}
        bootstrapError={bootstrapError}
        onChildLogin={handleChildLogin}
        onParentLogin={handleParentLogin}
      />
    );
  }

  const renderedTab = isParentRole(session.user.role) ? (
    <>
      {activeTab === "home" ? (
        <ParentHomeScreen
          modules={modules}
          onModulesLoaded={setModules}
          session={session}
        />
      ) : null}
      {activeTab === "children" ? <ChildrenScreen session={session} /> : null}
      {activeTab === "chores" ? <ChoresScreen session={session} /> : null}
      {activeTab === "review" ? <ParentReviewScreen /> : null}
      {activeTab === "homeschool" ? (
        <HomeschoolScreen modules={modules} session={session} />
      ) : null}
      {activeTab === "admin" ? <AdminScreen /> : null}
      {activeTab === "account" ? (
        <AccountScreen
          modules={modules}
          onLogout={handleLogout}
          session={session}
        />
      ) : null}
    </>
  ) : activeTab === "account" ? (
    <AccountScreen
      modules={modules}
      onLogout={handleLogout}
      session={session}
    />
  ) : (
    <ChildTodayScreen />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.appTitle}>Family Manager</Text>
          <Text style={styles.headerSubline}>
            {session.user.role.replace("_", " ")}
          </Text>
        </View>
        <View style={styles.sessionPill}>
          <Text style={styles.sessionPillText} numberOfLines={1}>
            {session.user.email}
          </Text>
        </View>
      </View>
      {bootstrapError !== null ? (
        <InlineNotice tone="warning" message={bootstrapError} />
      ) : null}
      <ScrollView
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderedTab}
      </ScrollView>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tabButton,
              activeTab === tab.key ? styles.tabButtonActive : null,
            ]}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === tab.key ? styles.tabButtonTextActive : null,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
