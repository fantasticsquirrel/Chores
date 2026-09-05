import { useState } from "react";

import { apiClient, type Child } from "../../../api";
import { formatApiError } from "../../../lib/errors";

type UseChildAccountActionsOptions = {
  children: Child[];
  householdId: number | null;
  selectedChildId: number | null;
};

type LinkAccountAction = {
  email: string;
  error: string | null;
  password: string;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  submit: () => Promise<void>;
  submitting: boolean;
  success: string | null;
};

type ResetEmailAction = {
  email: string;
  error: string | null;
  setEmail: (email: string) => void;
  submit: () => Promise<void>;
  submitting: boolean;
  success: string | null;
};

type ResetPasswordAction = {
  confirmation: string;
  error: string | null;
  password: string;
  setConfirmation: (password: string) => void;
  setPassword: (password: string) => void;
  submit: () => Promise<void>;
  submitting: boolean;
  success: string | null;
};

export type UseChildAccountActionsResult = {
  linkAccount: LinkAccountAction;
  resetEmail: ResetEmailAction;
  resetPassword: ResetPasswordAction;
};

export function useChildAccountActions({
  children,
  householdId,
  selectedChildId,
}: UseChildAccountActionsOptions): UseChildAccountActionsResult {
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

  function selectedChildName(): string {
    return (
      children.find((child) => child.id === selectedChildId)?.name ?? "child"
    );
  }

  async function createChildAccount(): Promise<void> {
    setLinkAccountError(null);
    setLinkAccountSuccess(null);

    if (householdId === null) {
      setLinkAccountError("Could not determine household scope.");
      return;
    }
    if (selectedChildId === null) {
      setLinkAccountError("Choose a child first.");
      return;
    }
    if (childEmail.trim().length > 0 && childEmail.trim().length < 3) {
      setLinkAccountError("If provided, email must be valid-ish length.");
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
      const childName = selectedChildName();
      setLinkAccountSuccess(
        `Linked login created for ${childName}. Child can sign in with a parent login email, ${childName}, and the child password. Legacy email ${account.email} still works for email/password sign-in.`,
      );
      setChildEmail("");
      setChildPassword("");
    } catch (error: unknown) {
      setLinkAccountError(formatApiError(error));
    } finally {
      setLinkingAccount(false);
    }
  }

  async function resetChildEmail(): Promise<void> {
    setResetEmailError(null);
    setResetEmailSuccess(null);

    if (householdId === null) {
      setResetEmailError("Could not determine household scope.");
      return;
    }
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
      const childName = selectedChildName();
      setResetEmailSuccess(
        `Updated legacy login email for ${childName}. Parent email + child name + child password is recommended; ${account.email} still works for email/password sign-in.`,
      );
      setResetEmailInput("");
    } catch (error: unknown) {
      setResetEmailError(formatApiError(error));
    } finally {
      setResettingEmail(false);
    }
  }

  async function resetChildPassword(): Promise<void> {
    setResetPasswordError(null);
    setResetPasswordSuccess(null);

    if (householdId === null) {
      setResetPasswordError("Could not determine household scope.");
      return;
    }
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
      const childName = selectedChildName();
      setResetPasswordSuccess(
        `Updated password for ${childName}. Child can sign in with a parent login email, ${childName}, and the new child password. Legacy email ${account.email} still works.`,
      );
      setResetPasswordInput("");
      setResetPasswordConfirm("");
    } catch (error: unknown) {
      setResetPasswordError(formatApiError(error));
    } finally {
      setResettingPassword(false);
    }
  }

  return {
    linkAccount: {
      email: childEmail,
      error: linkAccountError,
      password: childPassword,
      setEmail: setChildEmail,
      setPassword: setChildPassword,
      submit: createChildAccount,
      submitting: linkingAccount,
      success: linkAccountSuccess,
    },
    resetEmail: {
      email: resetEmailInput,
      error: resetEmailError,
      setEmail: setResetEmailInput,
      submit: resetChildEmail,
      submitting: resettingEmail,
      success: resetEmailSuccess,
    },
    resetPassword: {
      confirmation: resetPasswordConfirm,
      error: resetPasswordError,
      password: resetPasswordInput,
      setConfirmation: setResetPasswordConfirm,
      setPassword: setResetPasswordInput,
      submit: resetChildPassword,
      submitting: resettingPassword,
      success: resetPasswordSuccess,
    },
  };
}
