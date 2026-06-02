import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiClientError, apiClient } from "./src/api/client";
import type {
  AuthSessionResponse,
  Child,
  EligibleChore,
  FamilyModule,
  HomeschoolAttendance,
  HomeschoolDayComment,
  HomeschoolGrade,
  HomeschoolSemester,
  HomeschoolSubject,
  SubmissionReview,
  SubmissionReviewItem,
  UserRole,
} from "./src/api/models";

type AppTab = "home" | "review" | "homeschool" | "today" | "account";

const parentTabs: { key: AppTab; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "review", label: "Review" },
  { key: "homeschool", label: "School" },
  { key: "account", label: "Account" },
];

const childTabs: { key: AppTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "account", label: "Account" },
];

export default function App() {
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [modules, setModules] = useState<FamilyModule[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const loadModules = useCallback(async (): Promise<FamilyModule[]> => {
    const response = await apiClient.getMyModules();
    setModules(response.modules);
    return response.modules;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const currentSession = await apiClient.getCurrentSession();
        if (cancelled) {
          return;
        }
        setSession(currentSession);
        setActiveTab(defaultTabForRole(currentSession.user.role));

        try {
          await loadModules();
        } catch (error) {
          if (!cancelled) {
            setBootstrapError(`Signed in, but modules could not load: ${formatError(error)}`);
          }
        }
      } catch (error) {
        if (!cancelled && !isUnauthorized(error)) {
          setBootstrapError(formatError(error));
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [loadModules]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const nextSession = await apiClient.login({ email: email.trim(), password });
      setSession(nextSession);
      setActiveTab(defaultTabForRole(nextSession.user.role));
      setBootstrapError(null);
      try {
        await loadModules();
      } catch (error) {
        setBootstrapError(`Signed in, but modules could not load: ${formatError(error)}`);
      }
    },
    [loadModules],
  );

  const handleLogout = useCallback(async () => {
    await apiClient.logout();
    setSession(null);
    setModules([]);
    setActiveTab("home");
  }, []);

  const isParent = session !== null && isParentRole(session.user.role);
  const tabs = isParent ? parentTabs : childTabs;

  const renderedTab = useMemo(() => {
    if (session === null) {
      return null;
    }

    if (isParentRole(session.user.role)) {
      if (activeTab === "review") {
        return <ParentReviewScreen />;
      }
      if (activeTab === "homeschool") {
        return <HomeschoolSummaryScreen modules={modules} session={session} />;
      }
      if (activeTab === "account") {
        return (
          <AccountScreen
            modules={modules}
            onLogout={handleLogout}
            session={session}
          />
        );
      }
      return (
        <ParentHomeScreen
          modules={modules}
          onModulesLoaded={setModules}
          session={session}
        />
      );
    }

    if (activeTab === "account") {
      return (
        <AccountScreen
          modules={modules}
          onLogout={handleLogout}
          session={session}
        />
      );
    }
    return <ChildTodayScreen />;
  }, [activeTab, handleLogout, modules, session]);

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
        onLogin={handleLogin}
      />
    );
  }

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

function LoginScreen({
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
            Sign in with a parent or child account.
          </Text>
          <View style={styles.apiBasePanel}>
            <Text style={styles.apiBaseLabel}>API</Text>
            <Text style={styles.apiBaseValue} numberOfLines={2}>
              {apiBaseUrl}
            </Text>
          </View>
          <FieldLabel label="Email" />
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
          {error !== null ? <InlineNotice tone="error" message={error} /> : null}
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

function ParentHomeScreen({
  modules,
  onModulesLoaded,
  session,
}: {
  modules: FamilyModule[];
  onModulesLoaded: (modules: FamilyModule[]) => void;
  session: AuthSessionResponse;
}) {
  const [activeChildrenCount, setActiveChildrenCount] = useState<number | null>(
    null,
  );
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [children, submissions, moduleResponse] = await Promise.all([
        apiClient.listChildren({
          household_id: session.user.household_id,
          active_only: true,
        }),
        apiClient.listSubmissions({ status: "PENDING" }),
        apiClient.getMyModules(),
      ]);
      setActiveChildrenCount(children.length);
      setPendingCount(submissions.length);
      onModulesLoaded(moduleResponse.modules);
    } catch (refreshError) {
      setError(formatError(refreshError));
    } finally {
      setLoading(false);
    }
  }, [onModulesLoaded, session.user.household_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View>
      <ScreenHeader
        subtitle="Household snapshot"
        title="Home"
        trailing={
          <ActionButton
            compact
            disabled={loading}
            label={loading ? "Refreshing" : "Refresh"}
            onPress={refresh}
            variant="secondary"
          />
        }
      />
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      <View style={styles.statGrid}>
        <StatCard
          label="Active children"
          value={formatNullableCount(activeChildrenCount)}
        />
        <StatCard
          label="Pending reviews"
          value={formatNullableCount(pendingCount)}
        />
      </View>
      <SectionCard title="Enabled modules">
        {modules.length === 0 ? (
          <Text style={styles.mutedText}>No modules loaded yet.</Text>
        ) : (
          <View style={styles.chipRow}>
            {modules.map((module) => (
              <View key={module.key} style={styles.moduleChip}>
                <Text style={styles.moduleChipText}>{module.name}</Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>
    </View>
  );
}

function ChildTodayScreen() {
  const initialDate = useMemo(() => todayDateString(), []);
  const [date, setDate] = useState(initialDate);
  const [chores, setChores] = useState<EligibleChore[]>([]);
  const [selectedChoreIds, setSelectedChoreIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(
    async (nextDate: string) => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const eligible = await apiClient.listEligibleChores({ date: nextDate });
        setChores(eligible);
        setSelectedChoreIds(new Set());
      } catch (refreshError) {
        setError(formatError(refreshError));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void refresh(initialDate);
  }, [initialDate, refresh]);

  function toggleChore(choreId: number) {
    setSelectedChoreIds((current) => {
      const next = new Set(current);
      if (next.has(choreId)) {
        next.delete(choreId);
      } else {
        next.add(choreId);
      }
      return next;
    });
    setSuccess(null);
  }

  async function submitSelected() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.createSubmission({
        for_date: date,
        chore_ids: Array.from(selectedChoreIds),
      });
      setSuccess("Submitted for parent review.");
      await refresh(date);
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  function setToday() {
    const nextDate = todayDateString();
    setDate(nextDate);
    void refresh(nextDate);
  }

  return (
    <View>
      <ScreenHeader subtitle="Choose finished chores" title="Today" />
      <SectionCard title="Date">
        <TextInput
          autoCapitalize="none"
          onChangeText={(value) => {
            setDate(value);
            setSuccess(null);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={date}
        />
        <View style={styles.inlineButtons}>
          <ActionButton
            compact
            disabled={loading}
            label="Today"
            onPress={setToday}
            variant="secondary"
          />
          <ActionButton
            compact
            disabled={loading}
            label={loading ? "Loading" : "Refresh"}
            onPress={() => refresh(date)}
            variant="secondary"
          />
        </View>
      </SectionCard>
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      {success !== null ? <InlineNotice tone="success" message={success} /> : null}
      <SectionCard title="Eligible chores">
        {loading ? (
          <LoadingRow label="Loading chores" />
        ) : chores.length === 0 ? (
          <Text style={styles.mutedText}>No chores are available for this date.</Text>
        ) : (
          <View>
            {chores.map((chore) => (
              <Pressable
                key={chore.chore_id}
                accessibilityRole="button"
                onPress={() => toggleChore(chore.chore_id)}
                style={[
                  styles.selectableRow,
                  selectedChoreIds.has(chore.chore_id)
                    ? styles.selectableRowSelected
                    : null,
                ]}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{chore.name}</Text>
                  <Text style={styles.rowMeta}>
                    {formatCents(chore.reward_cents)}
                    {chore.expires_on ? ` · expires ${chore.expires_on}` : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.selectionMark,
                    selectedChoreIds.has(chore.chore_id)
                      ? styles.selectionMarkSelected
                      : null,
                  ]}
                >
                  {selectedChoreIds.has(chore.chore_id) ? "Selected" : "Select"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </SectionCard>
      <ActionButton
        disabled={selectedChoreIds.size === 0 || submitting}
        label={
          submitting
            ? "Submitting..."
            : `Submit ${selectedChoreIds.size || ""}`.trim()
        }
        onPress={submitSelected}
      />
    </View>
  );
}

function ParentReviewScreen() {
  const [submissions, setSubmissions] = useState<SubmissionReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pending = await apiClient.listSubmissions({ status: "PENDING" });
      setSubmissions(pending);
    } catch (refreshError) {
      setError(formatError(refreshError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function approveAll(submissionId: number) {
    setActionId(`submission-${submissionId}`);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.approveSubmission(submissionId);
      setSuccess("Submission approved.");
      await refresh();
    } catch (approvalError) {
      setError(formatError(approvalError));
    } finally {
      setActionId(null);
    }
  }

  async function decideItem(
    submissionId: number,
    item: SubmissionReviewItem,
    status: "APPROVED" | "REJECTED",
  ) {
    setActionId(`item-${item.id}-${status}`);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.decideSubmissionItem(submissionId, item.id, { status });
      setSuccess(status === "APPROVED" ? "Chore approved." : "Chore rejected.");
      await refresh();
    } catch (decisionError) {
      setError(formatError(decisionError));
    } finally {
      setActionId(null);
    }
  }

  return (
    <View>
      <ScreenHeader
        subtitle="Pending child submissions"
        title="Review"
        trailing={
          <ActionButton
            compact
            disabled={loading}
            label={loading ? "Refreshing" : "Refresh"}
            onPress={refresh}
            variant="secondary"
          />
        }
      />
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      {success !== null ? <InlineNotice tone="success" message={success} /> : null}
      {loading ? (
        <SectionCard title="Pending">
          <LoadingRow label="Loading submissions" />
        </SectionCard>
      ) : submissions.length === 0 ? (
        <SectionCard title="Pending">
          <Text style={styles.mutedText}>No pending submissions.</Text>
        </SectionCard>
      ) : (
        submissions.map((submission) => (
          <SectionCard
            key={submission.id}
            subtitle={`${submission.child_name} · ${submission.for_date}`}
            title={`Submission #${submission.id}`}
          >
            {submission.items.map((item) => (
              <View key={item.id} style={styles.reviewItem}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{item.chore_name}</Text>
                  <Text style={styles.rowMeta}>
                    {formatCents(item.chore_reward_cents)} · {item.status}
                  </Text>
                </View>
                <View style={styles.itemButtonRow}>
                  <ActionButton
                    compact
                    disabled={actionId !== null}
                    label="Approve"
                    onPress={() => decideItem(submission.id, item, "APPROVED")}
                    variant="secondary"
                  />
                  <ActionButton
                    compact
                    disabled={actionId !== null}
                    label="Reject"
                    onPress={() => decideItem(submission.id, item, "REJECTED")}
                    variant="danger"
                  />
                </View>
              </View>
            ))}
            <ActionButton
              disabled={actionId !== null}
              label={
                actionId === `submission-${submission.id}`
                  ? "Approving..."
                  : "Approve all"
              }
              onPress={() => approveAll(submission.id)}
            />
          </SectionCard>
        ))
      )}
    </View>
  );
}

function HomeschoolSummaryScreen({
  modules,
  session,
}: {
  modules: FamilyModule[];
  session: AuthSessionResponse;
}) {
  const homeschoolEnabled = hasModule(modules, "homeschool");
  const [children, setChildren] = useState<Child[]>([]);
  const [semesters, setSemesters] = useState<HomeschoolSemester[]>([]);
  const [subjects, setSubjects] = useState<HomeschoolSubject[]>([]);
  const [attendance, setAttendance] = useState<HomeschoolAttendance[]>([]);
  const [comments, setComments] = useState<HomeschoolDayComment[]>([]);
  const [grades, setGrades] = useState<HomeschoolGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!homeschoolEnabled) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const householdId = session.user.household_id;
      const [
        childRows,
        semesterRows,
        subjectRows,
        attendanceRows,
        commentRows,
        gradeRows,
      ] = await Promise.all([
        apiClient.listChildren({ household_id: householdId, active_only: true }),
        apiClient.listHomeschoolSemesters(householdId),
        apiClient.listHomeschoolSubjects(householdId),
        apiClient.listHomeschoolAttendance(householdId),
        apiClient.listHomeschoolDayComments(householdId),
        apiClient.listHomeschoolGrades(householdId),
      ]);
      setChildren(childRows);
      setSemesters(semesterRows);
      setSubjects(subjectRows);
      setAttendance(attendanceRows);
      setComments(commentRows);
      setGrades(gradeRows);
    } catch (refreshError) {
      setError(formatError(refreshError));
    } finally {
      setLoading(false);
    }
  }, [homeschoolEnabled, session.user.household_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!homeschoolEnabled) {
    return (
      <View>
        <ScreenHeader subtitle="Module summary" title="Homeschool" />
        <SectionCard title="Unavailable">
          <Text style={styles.mutedText}>
            Homeschool is not enabled for this account.
          </Text>
        </SectionCard>
      </View>
    );
  }

  const activeSubjects = subjects.filter((subject) => subject.active);
  const activeSemesters = semesters.filter((semester) => semester.active);
  const recentComments = comments.slice(0, 3);

  return (
    <View>
      <ScreenHeader
        subtitle="Compact school overview"
        title="Homeschool"
        trailing={
          <ActionButton
            compact
            disabled={loading}
            label={loading ? "Refreshing" : "Refresh"}
            onPress={refresh}
            variant="secondary"
          />
        }
      />
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      <View style={styles.statGrid}>
        <StatCard label="Children" value={children.length.toString()} />
        <StatCard label="Subjects" value={activeSubjects.length.toString()} />
        <StatCard label="Attendance" value={attendance.length.toString()} />
        <StatCard label="Grades" value={grades.length.toString()} />
      </View>
      <SectionCard
        subtitle={
          activeSemesters.length > 0
            ? activeSemesters.map((semester) => semester.name).join(", ")
            : undefined
        }
        title="Active semesters"
      >
        <Text style={styles.mutedText}>
          {activeSemesters.length > 0
            ? `${activeSemesters.length} active semester record${
                activeSemesters.length === 1 ? "" : "s"
              }.`
            : "No active semester records."}
        </Text>
      </SectionCard>
      <SectionCard title="Recent comments">
        {loading ? (
          <LoadingRow label="Loading homeschool data" />
        ) : recentComments.length === 0 ? (
          <Text style={styles.mutedText}>No day comments yet.</Text>
        ) : (
          recentComments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <Text style={styles.rowTitle}>{comment.date}</Text>
              <Text style={styles.rowMeta} numberOfLines={3}>
                {comment.comment}
              </Text>
            </View>
          ))
        )}
      </SectionCard>
    </View>
  );
}

function AccountScreen({
  modules,
  onLogout,
  session,
}: {
  modules: FamilyModule[];
  onLogout: () => Promise<void>;
  session: AuthSessionResponse;
}) {
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitLogout() {
    setLogoutLoading(true);
    setError(null);
    try {
      await onLogout();
    } catch (logoutError) {
      setError(`Could not log out: ${formatError(logoutError)}`);
    } finally {
      setLogoutLoading(false);
    }
  }

  return (
    <View>
      <ScreenHeader subtitle="Signed-in account" title="Account" />
      <SectionCard title="Profile">
        <InfoRow label="Email" value={session.user.email} />
        <InfoRow label="Role" value={session.user.role.replace("_", " ")} />
        <InfoRow
          label="Household"
          value={session.user.household_id.toString()}
        />
        {session.user.child_id !== null && session.user.child_id !== undefined ? (
          <InfoRow label="Child" value={session.user.child_id.toString()} />
        ) : null}
      </SectionCard>
      <SectionCard title="Modules">
        {modules.length === 0 ? (
          <Text style={styles.mutedText}>No modules loaded.</Text>
        ) : (
          modules.map((module) => (
            <InfoRow key={module.key} label={module.name} value={module.key} />
          ))
        )}
      </SectionCard>
      {error !== null ? <InlineNotice tone="error" message={error} /> : null}
      <ActionButton
        disabled={logoutLoading}
        label={logoutLoading ? "Logging out..." : "Log out"}
        onPress={submitLogout}
        variant="danger"
      />
    </View>
  );
}

function ScreenHeader({
  subtitle,
  title,
  trailing,
}: {
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderText}>
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle !== undefined ? (
          <Text style={styles.screenSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing !== undefined ? <View>{trailing}</View> : null}
    </View>
  );
}

function SectionCard({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle !== undefined ? (
          <Text style={styles.cardSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color="#0f766e" />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

function InlineNotice({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success" | "warning";
}) {
  return (
    <View
      style={[
        styles.notice,
        tone === "error" ? styles.noticeError : null,
        tone === "success" ? styles.noticeSuccess : null,
        tone === "warning" ? styles.noticeWarning : null,
      ]}
    >
      <Text
        style={[
          styles.noticeText,
          tone === "error" ? styles.noticeTextError : null,
          tone === "success" ? styles.noticeTextSuccess : null,
          tone === "warning" ? styles.noticeTextWarning : null,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

function ActionButton({
  compact = false,
  disabled = false,
  label,
  onPress,
  variant = "primary",
}: {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.buttonCompact : null,
        variant === "secondary" ? styles.buttonSecondary : null,
        variant === "danger" ? styles.buttonDanger : null,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === "secondary" ? styles.buttonSecondaryText : null,
          disabled ? styles.buttonTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function isParentRole(role: UserRole): boolean {
  return role === "PARENT" || role === "PARENT_ADMIN";
}

function defaultTabForRole(role: UserRole): AppTab {
  return isParentRole(role) ? "home" : "today";
}

function hasModule(modules: FamilyModule[], key: string): boolean {
  return modules.some((module) => module.key === key);
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

function formatError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Request failed.";
}

function formatNullableCount(value: number | null): string {
  return value === null ? "-" : value.toString();
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function todayDateString(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f8f5",
  },
  centeredPanel: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  loginContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  loginCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e6de",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 2,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  loginTitle: {
    color: "#12343b",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0,
  },
  loginSubtitle: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
  },
  apiBasePanel: {
    backgroundColor: "#eef6f1",
    borderColor: "#cfe4d7",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 12,
  },
  apiBaseLabel: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  apiBaseValue: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  appHeader: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#dbe7e1",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  appTitle: {
    color: "#12343b",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
  },
  headerSubline: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    marginTop: 2,
  },
  sessionPill: {
    backgroundColor: "#f8fafc",
    borderColor: "#d8e4de",
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: "52%",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sessionPillText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  screenContent: {
    padding: 16,
    paddingBottom: 22,
  },
  screenHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 14,
  },
  screenHeaderText: {
    flex: 1,
  },
  screenTitle: {
    color: "#12343b",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0,
  },
  screenSubtitle: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 3,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe7e1",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    marginBottom: 14,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitle: {
    color: "#12343b",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0,
  },
  cardSubtitle: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe7e1",
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    flexBasis: "46%",
    marginBottom: 10,
    minHeight: 86,
    padding: 14,
  },
  statValue: {
    color: "#be185d",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0,
  },
  statLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  moduleChip: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  moduleChipText: {
    color: "#9a3412",
    fontSize: 13,
    fontWeight: "800",
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  selectableRow: {
    alignItems: "center",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 9,
    padding: 12,
  },
  selectableRowSelected: {
    backgroundColor: "#f0fdfa",
    borderColor: "#14b8a6",
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: "#12343b",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  rowMeta: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  selectionMark: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
  selectionMarkSelected: {
    color: "#0f766e",
  },
  reviewItem: {
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    marginBottom: 12,
    paddingBottom: 12,
  },
  itemButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  commentRow: {
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    marginBottom: 10,
    paddingBottom: 10,
  },
  infoRow: {
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    paddingVertical: 9,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  infoValue: {
    color: "#12343b",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 3,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  mutedText: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
  },
  notice: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeError: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
  },
  noticeSuccess: {
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
  },
  noticeWarning: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  noticeText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  noticeTextError: {
    color: "#be123c",
  },
  noticeTextSuccess: {
    color: "#047857",
  },
  noticeTextWarning: {
    color: "#92400e",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonCompact: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonSecondary: {
    backgroundColor: "#eef6f1",
    borderColor: "#b8d8ca",
    borderWidth: 1,
  },
  buttonDanger: {
    backgroundColor: "#be123c",
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    backgroundColor: "#cbd5e1",
    borderColor: "#cbd5e1",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  buttonSecondaryText: {
    color: "#0f766e",
  },
  buttonTextDisabled: {
    color: "#f8fafc",
  },
  tabBar: {
    backgroundColor: "#ffffff",
    borderTopColor: "#dbe7e1",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabButtonActive: {
    backgroundColor: "#ecfdf5",
  },
  tabButtonText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
  tabButtonTextActive: {
    color: "#0f766e",
  },
});
