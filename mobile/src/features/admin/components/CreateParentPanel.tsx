import { TextInput } from "react-native";
import { ActionButton } from "../../../components/ActionButton";
import { ChoiceGroup } from "../../../components/ChoiceGroup";
import { FieldLabel } from "../../../components/FieldLabel";
import { InlineNotice } from "../../../components/InlineNotice";
import { SectionCard } from "../../../components/SectionCard";
import { formStyles } from "../../../styles/forms";
import { useFormTheme } from "../../../styles/themedForms";

type ParentRole = "PARENT" | "PARENT_ADMIN";
type Props = {
  email: string;
  password: string;
  role: ParentRole;
  creating: boolean;
  error: string | null;
  onClose: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (value: ParentRole) => void;
  onSubmit: () => void;
};

export function CreateParentPanel({ email, password, role, creating, error, onClose, onEmailChange, onPasswordChange, onRoleChange, onSubmit }: Props) {
  const theme = useFormTheme();
  return <SectionCard title="Add Parent Login" subtitle="Create a parent login in this household.">
    <ActionButton label="Back to module management" variant="secondary" disabled={creating} onPress={onClose} />
    {error ? <InlineNotice tone="error" message={`Could not create parent login: ${error}`} /> : null}
    <FieldLabel label="Email" />
    <TextInput autoFocus accessibilityLabel="Email" editable={!creating} autoCapitalize="none" keyboardType="email-address"
      onChangeText={onEmailChange} placeholder="other.parent@example.com" placeholderTextColor={theme.placeholder}
      style={[formStyles.input, theme.input]} value={email} />
    <FieldLabel label="Temporary Password" />
    <TextInput accessibilityLabel="Temporary Password" editable={!creating} onChangeText={onPasswordChange}
      placeholder="At least 8 characters" placeholderTextColor={theme.placeholder} secureTextEntry style={[formStyles.input, theme.input]} value={password} />
    <FieldLabel label="Role" />
    <ChoiceGroup disabled={creating} onChange={onRoleChange} options={[
      { label: "Parent", value: "PARENT" },
      { label: "Parent Admin", value: "PARENT_ADMIN" },
    ]} value={role} />
    <ActionButton disabled={creating} label={creating ? "Creating..." : "Create Parent Login"} onPress={onSubmit} requiresManage />
  </SectionCard>;
}
