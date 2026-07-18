import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from "react-native";

import { apiClient } from "./api/client";
import { InlineNotice } from "./components/InlineNotice";
import { SafeAreaScreen } from "./components/SafeAreaScreen";
import { useModules } from "./hooks/useModules";
import { useSessionBootstrap } from "./hooks/useSessionBootstrap";
import { BottomNavigation } from "./navigation/BottomNavigation";
import { OverflowMenu } from "./navigation/OverflowMenu";
import {
  buildNavigationLayout,
  resolveActiveTab,
} from "./navigation/tabs";
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

  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<View>(null);
  const navigation = useMemo(
    () =>
      session === null
        ? { overflow: [], primary: [] }
        : buildNavigationLayout(session.user.role, modules),
    [modules, session],
  );

  useEffect(() => {
    if (session === null) {
      setMoreOpen(false);
      return;
    }
    const nextTab = resolveActiveTab(navigation, activeTab, session.user.role);
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, navigation, session, setActiveTab]);

  useEffect(() => {
    setMoreOpen(false);
  }, [navigation, session?.user.id, session?.user.role]);

  if (bootstrapping) {
    return (
      <SafeAreaScreen>
        <StatusBar style="dark" />
        <View style={styles.centeredPanel}>
          <ActivityIndicator color="#0f766e" size="large" />
          <Text style={styles.mutedText}>Opening Family Manager</Text>
        </View>
      </SafeAreaScreen>
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
    <SafeAreaScreen bottom={false}>
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
      <BottomNavigation
        activeTab={activeTab}
        layout={navigation}
        moreButtonRef={moreButtonRef}
        onNavigate={(tab) => {
          setActiveTab(tab);
          setMoreOpen(false);
        }}
        onOpenMore={() => setMoreOpen(true)}
      />
      <OverflowMenu
        activeTab={activeTab}
        items={navigation.overflow}
        onClose={() => setMoreOpen(false)}
        onNavigate={setActiveTab}
        returnFocusRef={moreButtonRef}
        visible={moreOpen}
      />
    </SafeAreaScreen>
  );
}
