import { useEffect, useRef, type FormEvent, type ReactElement } from "react";

import {
  Button,
  Card,
  FormField,
  InlineNotice,
  Select,
  TextInput,
} from "../../../ui";
import type { ParentRole } from "../hooks/useAdminUsers";

type CreateParentPanelProps = {
  error: string | null;
  onClose: () => void;
  createParent: () => Promise<void>;
  creating: boolean;
  email: string;
  password: string;
  role: ParentRole;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setRole: (role: ParentRole) => void;
};

export function CreateParentPanel({
  error,
  onClose,
  createParent,
  creating,
  email,
  password,
  role,
  setEmail,
  setPassword,
  setRole,
}: CreateParentPanelProps): ReactElement {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void createParent();
  }

  return (
    <Card className="dashboard-panel">
      <h2>Add Parent Login</h2>
      <p>
        Create another parent login in this household. Parent admins can also
        manage module access.
      </p>
      {error ? (
        <InlineNotice variant="error">
          Could not create parent login: {error}
        </InlineNotice>
      ) : null}
      <form ref={form} className="children-form" onSubmit={handleSubmit}>
        <FormField label="Email">
          <TextInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="other.parent@example.com"
            disabled={creating}
          />
        </FormField>
        <FormField label="Temporary Password">
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            disabled={creating}
          />
        </FormField>
        <FormField label="Role">
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value as ParentRole)}
            disabled={creating}
          >
            <option value="PARENT">Parent</option>
            <option value="PARENT_ADMIN">Parent Admin</option>
          </Select>
        </FormField>
        <div className="quick-actions">
          <Button variant="secondary" disabled={creating} onClick={onClose}>
            Back to module management
          </Button>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create Parent Login"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
