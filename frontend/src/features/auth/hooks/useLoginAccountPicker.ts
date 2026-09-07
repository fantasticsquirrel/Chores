import { useEffect, useState } from "react";

import { apiClient, type LoginAccount } from "../../../api";

type LoginAccountPicker = {
  accountListUnavailable: boolean;
  childAccounts: LoginAccount[];
  parentAccounts: LoginAccount[];
  selectedChildAccount: string;
  selectedParentAccount: string;
  selectChildAccount: (accountToken: string) => void;
  selectParentAccount: (accountToken: string) => void;
};

export function useLoginAccountPicker(): LoginAccountPicker {
  const [loginAccounts, setLoginAccounts] = useState<LoginAccount[]>([]);
  const [selectedParentAccount, setSelectedParentAccount] = useState("");
  const [selectedChildAccount, setSelectedChildAccount] = useState("");
  const [accountListUnavailable, setAccountListUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void apiClient
      .listLoginAccounts()
      .then((accounts) => {
        if (!cancelled) {
          setLoginAccounts(accounts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccountListUnavailable(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    accountListUnavailable,
    childAccounts: loginAccounts.filter((account) => account.mode === "child"),
    parentAccounts: loginAccounts.filter((account) => account.mode === "parent"),
    selectedChildAccount,
    selectedParentAccount,
    selectChildAccount: setSelectedChildAccount,
    selectParentAccount: setSelectedParentAccount,
  };
}
