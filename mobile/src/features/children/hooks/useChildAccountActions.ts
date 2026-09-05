import { useState } from "react";

import { apiClient } from "../../../api/client";
import type { Child } from "../../../api/models";
import { formatError } from "../../../utils/format";

type UseChildAccountActionsOptions = {
  children: Child[];
  householdId: number;
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
  const [childEmail, setChildEmailState] = useState("");
  const [childPassword, setChildPasswordState] = useState("");
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [linkAccountError, setLinkAccountError] = useState<string | null>(null);
  const [linkAccountSuccess, setLinkAccountSuccess] = useState<string | null>(
    null,
  );
  const [resetEmailInput, setResetEmailInputState] = useState("");
  const [resettingEmail, setResettingEmail] = useState(false);
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);
  const [resetEmailSuccess, setResetEmailSuccess] = useState<string | null>(
    null,
  );
  const [resetPasswordInput, setResetPasswordInputState] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirmState] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(
    null,
  );
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<
    string | null
  >(null);

  function selectedChildName() {
    return (
      children.find((child) => child.id === selectedChildId)?.name ?? "child"
    );
  }

  function setChildEmail(email: string) {
    setChildEmailState(email);
    setLinkAccountError(null);
    setLinkAccountSuccess(null);
  }

  function setChildPassword(password: string) {
    setChildPasswordState(password);
    setLinkAccountError(null);
    setLinkAccountSuccess(null);
  }

  function setResetEmailInput(email: string) {
    setResetEmailInputState(email);
    setResetEmailError(null);
    setResetEmailSuccess(null);
  }

  function setResetPasswordInput(password: string) {
    setResetPasswordInputState(password);
    setResetPasswordError(null);
    setResetPasswordSuccess(null);
  }

  function setResetPasswordConfirm(password: string) {
    setResetPasswordConfirmState(password);
    setResetPasswordError(null);
    setResetPasswordSuccess(null);
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
      const childName = selectedChildName();
      setLinkAccountSuccess(
        `Linked login created for ${childName}. Child can sign in with a parent login email, ${childName}, and the child password. Legacy email ${account.email} still works for email/password sign-in.`,
      );
      setChildEmailState("");
      setChildPasswordState("");
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
      const childName = selectedChildName();
      setResetEmailSuccess(
        `Updated legacy login email for ${childName}. Parent email + child name + child password is recommended; ${account.email} still works for email/password sign-in.`,
      );
      setResetEmailInputState("");
    } catch (error) {
      setResetEmailError(
        `Could not reset child email: ${formatError(error)}`,
      );
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
      const childName = selectedChildName();
      setResetPasswordSuccess(
        `Updated password for ${childName}. Child can sign in with a parent login email, ${childName}, and the new child password. Legacy email ${account.email} still works.`,
      );
      setResetPasswordInputState("");
      setResetPasswordConfirmState("");
    } catch (error) {
      setResetPasswordError(
        `Could not reset child password: ${formatError(error)}`,
      );
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
