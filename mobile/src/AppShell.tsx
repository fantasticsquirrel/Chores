import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { apiClient } from "./api/client";
import { InlineNotice } from "./components/InlineNotice";
import { SafeAreaScreen } from "./components/SafeAreaScreen";
import { useModules } from "./hooks/useModules";
import { useSessionBootstrap } from "./hooks/useSessionBootstrap";
import { canAccessMobileModule } from "./modules/registry";
import { ModuleAccessProvider } from "./modules/ModuleAccessContext";
import { BottomNavigation } from "./navigation/BottomNavigation";
import { OverflowMenu } from "./navigation/OverflowMenu";
import { buildNavigationLayout, resolveActiveTab } from "./navigation/tabs";
import { AccountScreen } from "./screens/account/AccountScreen";
import { AdminScreen } from "./screens/admin/AdminScreen";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { ChildTodayScreen } from "./screens/child/ChildTodayScreen";
import { HomeschoolScreen } from "./screens/homeschool/HomeschoolScreen";
import { ChildrenScreen } from "./screens/parent/ChildrenScreen";
import { ChoresScreen } from "./screens/parent/ChoresScreen";
import { ParentHomeScreen } from "./screens/parent/ParentHomeScreen";
import { ParentReviewScreen } from "./screens/parent/ReviewScreen";
import { MoneyScreen } from "./screens/parent/MoneyScreen";
import { RecipesScreen } from "./screens/recipes/RecipesScreen";
import { NotificationsScreen } from "./screens/notifications/NotificationsScreen";
import { shellStyles } from "./styles/shell";
import { isParentRole } from "./utils/format";
import { useTheme } from "./theme/ThemeContext";
import { useNativePush } from "./features/notifications/lib/useNativePush";

export function AppShell() {
  const { definition, theme } = useTheme();
  const { loadModules, modules, setModules } = useModules();
  const {
    activeTab,
    bootstrapping,
    bootstrapError,
    clearSession,
    handleChildLogin,
    handleLogout,
    handleParentLogin,
    session,
    setActiveTab,
  } = useSessionBootstrap({ loadModules, setModules });

  const nativePush = useNativePush(session, modules, setActiveTab);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const resetScroll = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []);
  useEffect(resetScroll, [activeTab, resetScroll]);
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
        <StatusBar style={definition.dark ? "light" : "dark"} />
        <View style={shellStyles.centeredPanel}>
          <ActivityIndicator color="#0f766e" size="large" />
          <Text style={shellStyles.mutedText}>Opening Family Manager</Text>
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
          onNavigate={setActiveTab}
          session={session}
        />
      ) : null}
      {activeTab === "children" && canAccessMobileModule(modules, "chores") ? <ChildrenScreen session={session} /> : null}
      {activeTab === "chores" && canAccessMobileModule(modules, "chores") ? (
        <ChoresScreen session={session} />
      ) : null}
      {activeTab === "review" && canAccessMobileModule(modules, "chores") ? (
        <ParentReviewScreen />
      ) : null}
      {activeTab === "money" && canAccessMobileModule(modules, "chores") ? (
        <MoneyScreen />
      ) : null}
      {activeTab === "homeschool" &&
      canAccessMobileModule(modules, "homeschool") ? (
        <HomeschoolScreen modules={modules} session={session} />
      ) : null}
      {activeTab === "admin" && canAccessMobileModule(modules, "admin") ? (
        <AdminScreen
          onModulesChanged={async () => {
            await loadModules();
          }}
        />
      ) : null}
      {activeTab === "recipes" && canAccessMobileModule(modules, "recipes") ? <RecipesScreen session={session} modules={modules} onViewChanged={resetScroll} /> : null}
      {activeTab === "notifications" ? <NotificationsScreen session={session} modules={modules} onNavigate={setActiveTab} nativePush={nativePush} /> : null}
      {activeTab === "account" ? (
        <AccountScreen
          modules={modules}
          onLogout={handleLogout}
          onPasswordChanged={() => clearSession("Password changed. Sign in again.")}
          session={session}
        />
      ) : null}
    </>
  ) : activeTab === "account" ? (
    <AccountScreen
      modules={modules}
      onLogout={handleLogout}
          onPasswordChanged={() => clearSession("Password changed. Sign in again.")}
      session={session}
    />
  ) : activeTab === "money" && canAccessMobileModule(modules, "chores") ? (
    <MoneyScreen readOnly />
  ) : activeTab === "notifications" ? (
    <NotificationsScreen session={session} modules={modules} onNavigate={setActiveTab} nativePush={nativePush} />
  ) : canAccessMobileModule(modules, "chores") ? (
    <ChildTodayScreen />
  ) : (
    <InlineNotice
      tone="warning"
      message="This module is not enabled for your account."
    />
  );

  const moduleKey = ["children", "chores", "review", "money", "today"].includes(activeTab)
    ? "chores"
    : activeTab === "homeschool" || activeTab === "admin" || activeTab === "recipes" ? activeTab : null;
  const activeModule = moduleKey === null ? null : modules.find(module => module.key === moduleKey) ?? null;

  return (
    <SafeAreaScreen bottom={false} key={theme}>
      <StatusBar style={definition.dark ? "light" : "dark"} />
      <View style={shellStyles.appHeader}>
        <View>
          <Text style={shellStyles.appTitle}>Family Manager</Text>
          <Text style={shellStyles.headerSubline}>
            {session.user.role.replace("_", " ")}
          </Text>
        </View>
        <View style={shellStyles.sessionPill}>
          <Text style={shellStyles.sessionPillText} numberOfLines={1}>
            {session.user.email}
          </Text>
        </View>
      </View>
      {bootstrapError !== null ? (
        <InlineNotice tone="warning" message={bootstrapError} />
      ) : null}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={shellStyles.screenContent}
        keyboardShouldPersistTaps="handled"
      >
        {moduleKey !== null ? <ModuleAccessProvider module={activeModule}>
          {activeModule?.can_manage !== true ? <InlineNotice tone="warning" message="View-only access" /> : null}
          {renderedTab}
        </ModuleAccessProvider> : renderedTab}
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
