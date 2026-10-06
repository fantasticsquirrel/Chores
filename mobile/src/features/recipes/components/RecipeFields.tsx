import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formStyles } from '../../../styles/forms';
import { shellStyles } from '../../../styles/shell';
import { useFormTheme } from '../../../styles/themedForms';

export function Field({ label, value, onChange, numeric = false, multiline = false, disabled = false }: { label: string; value: string; onChange: (text: string) => void; numeric?: boolean; multiline?: boolean; disabled?: boolean }) {
  const theme = useFormTheme();
  const [focused, setFocused] = useState(false);
  return <View><Text style={[formStyles.fieldLabel, theme.label]}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} keyboardType={numeric ? 'decimal-pad' : 'default'} autoCapitalize={numeric || /URL|JSON/.test(label) ? 'none' : 'sentences'} multiline={multiline} placeholder={label} placeholderTextColor={theme.placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[formStyles.input, theme.input, focused && theme.inputFocused, multiline && formStyles.multilineInput]} /></View>;
}
export function Toggle({ label, checked, onPress, disabled = false }: { label: string; checked: boolean; onPress: () => void; disabled?: boolean }) {
  const theme = useFormTheme();
  return <Pressable aria-checked={checked} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={[formStyles.selectableRow, theme.row, checked && theme.rowSelected, { minHeight: 48, marginTop: 8 }]}><Text style={[formStyles.rowTitle, theme.title]}>{checked ? '✓ ' : '○ '}{label}</Text></Pressable>;
}
export function Copy({ text }: { text: string }) {
  const theme = useFormTheme();
  return <Text selectable style={[shellStyles.mutedText, theme.help]}>{text}</Text>;
}
