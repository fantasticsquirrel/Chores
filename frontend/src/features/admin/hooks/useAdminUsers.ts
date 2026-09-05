import { useCallback, useEffect, useState } from "react";

import {
  apiClient,
  type UserModuleAccess,
  type UserRole,
} from "../../../api";
import { formatApiError } from "../../../lib/errors";
import type { FamilyModuleKey } from "../../../modules/registry";
import { hasModule } from "../lib/moduleAccess";

export type ParentRole = Extract<UserRole, "PARENT" | "PARENT_ADMIN">;

export type UseAdminUsersResult = {
  actionError: string | null;
  actionMessage: string | null;
  createParent: () => Promise<void>;
  creatingParent: boolean;
  error: string | null;
  loadUsers: () => void;
  loading: boolean;
  newParentEmail: string;
  newParentPassword: string;
  newParentRole: ParentRole;
  setNewParentEmail: (email: string) => void;
  setNewParentPassword: (password: string) => void;
  setNewParentRole: (role: ParentRole) => void;
  toggleAccess: (
    user: UserModuleAccess,
    moduleKey: FamilyModuleKey,
  ) => Promise<void>;
  users: UserModuleAccess[];
};

export function useAdminUsers(): UseAdminUsersResult {
  const [users, setUsers] = useState<UserModuleAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [newParentEmail, setNewParentEmail] = useState("");
  const [newParentPassword, setNewParentPassword] = useState("");
  const [newParentRole, setNewParentRole] = useState<ParentRole>("PARENT");
  const [creatingParent, setCreatingParent] = useState(false);

  const loadUsers = useCallback((): void => {
    setLoading(true);
    setError(null);
    apiClient
      .listUserModuleAccess()
      .then((rows) => {
        setUsers(rows);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        setUsers([]);
        setLoading(false);
        setError(formatApiError(loadError));
      });
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function toggleAccess(
    user: UserModuleAccess,
    moduleKey: FamilyModuleKey,
  ): Promise<void> {
    setActionError(null);
    setActionMessage(null);
    const nextCanView = !hasModule(user, moduleKey);

    try {
      const updated = await apiClient.setUserModuleAccess(user.id, {
        module_key: moduleKey,
        can_view: nextCanView,
        can_manage: moduleKey === "admin" && nextCanView,
      });
      setUsers((previous) =>
        previous.map((row) => (row.id === updated.id ? updated : row)),
      );
      const nowEnabled = hasModule(updated, moduleKey);
      setActionMessage(
        `${updated.email} ${nowEnabled ? "can now access" : "cannot access"} ${moduleKey}.`,
      );
    } catch (updateError: unknown) {
      setActionError(formatApiError(updateError));
    }
  }

  async function createParent(): Promise<void> {
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
      setUsers((previous) =>
        [...previous.filter((row) => row.id !== created.id), created].sort(
          (a, b) => a.email.localeCompare(b.email),
        ),
      );
      setNewParentEmail("");
      setNewParentPassword("");
      setNewParentRole("PARENT");
      setActionMessage(
        `Created ${created.role === "PARENT_ADMIN" ? "admin" : "parent"} login for ${created.email}.`,
      );
    } catch (createError: unknown) {
      setActionError(formatApiError(createError));
    } finally {
      setCreatingParent(false);
    }
  }

  return {
    actionError,
    actionMessage,
    createParent,
    creatingParent,
    error,
    loadUsers,
    loading,
    newParentEmail,
    newParentPassword,
    newParentRole,
    setNewParentEmail,
    setNewParentPassword,
    setNewParentRole,
    toggleAccess,
    users,
  };
}
