import { Pressable, Text, TextInput, View } from 'react-native';
import { formStyles } from '../../../styles/forms';
import { shellStyles } from '../../../styles/shell';

export function Field({ label, value, onChange, numeric = false, multiline = false, disabled = false }: { label: string; value: string; onChange: (text: string) => void; numeric?: boolean; multiline?: boolean; disabled?: boolean }) {
  return <View><Text style={formStyles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} keyboardType={numeric ? 'decimal-pad' : 'default'} autoCapitalize={numeric || /URL|JSON/.test(label) ? 'none' : 'sentences'} multiline={multiline} style={[formStyles.input, multiline && formStyles.multilineInput]} /></View>;
}
export function Toggle({ label, checked, onPress, disabled = false }: { label: string; checked: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={[formStyles.selectableRow, checked && formStyles.selectableRowSelected, { minHeight: 48, marginTop: 8 }]}><Text style={formStyles.rowTitle}>{checked ? '✓ ' : '○ '}{label}</Text></Pressable>;
}
export const Copy = ({ text }: { text: string }) => <Text selectable style={shellStyles.mutedText}>{text}</Text>;
