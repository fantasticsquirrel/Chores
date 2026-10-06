import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { applyThemeColors, colors, themeIds, type ThemeId } from '../../../styles/colors';
import { refreshFormStyles } from '../../../styles/forms';
import { refreshShellStyles } from '../../../styles/shell';
import { contrastRatio } from '../../../test/contrast';
import { ThemeProvider, useTheme } from '../../../theme/ThemeContext';
import { Copy, Field, Toggle } from './RecipeFields';

function apply(theme: ThemeId) {
  applyThemeColors(theme);
  refreshFormStyles();
  refreshShellStyles();
}
afterEach(() => { apply('paper-pine'); });
const field = () => screen.getByLabelText('Recipe title');
const fieldStyle = () => StyleSheet.flatten(field().props.style);

function mountField(value = 'Soup') {
  render(<Field label="Recipe title" value={value} onChange={jest.fn()} />);
}

describe.each(themeIds)('recipe form contrast: %s', (theme) => {
  it('uses readable runtime label text on card and screen surfaces', () => {
    apply(theme); mountField();
    const label = StyleSheet.flatten(screen.getByText('Recipe title').props.style);
    expect(label.color).toBe(colors.text);
    for (const background of [colors.surface, colors.background]) {
      expect(contrastRatio(label.color, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('uses readable runtime entered text', () => {
    apply(theme); mountField();
    expect(fieldStyle().color).toBe(colors.text);
    expect(fieldStyle().backgroundColor).toBe(colors.surface);
    expect(contrastRatio(fieldStyle().color, fieldStyle().backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });
  it('gives empty fields an explicit readable placeholder', () => {
    apply(theme); mountField('');
    expect(field().props.placeholder).toBe('Recipe title');
    expect(field().props.placeholderTextColor).toBe(colors.textSubtle);
    expect(contrastRatio(field().props.placeholderTextColor, fieldStyle().backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });
  it('draws a visible input boundary against its inside and surrounding surfaces', () => {
    apply(theme); mountField();
    expect(fieldStyle().borderWidth).toBeGreaterThanOrEqual(1);
    for (const background of [fieldStyle().backgroundColor, colors.background]) {
      expect(contrastRatio(fieldStyle().borderColor, background)).toBeGreaterThanOrEqual(3);
    }
  });
  it('shows a distinct high-contrast focus boundary and restores it on blur', () => {
    apply(theme); mountField();
    const restingBorder = fieldStyle().borderColor;
    fireEvent(field(), 'focus');
    expect(fieldStyle().borderColor).not.toBe(restingBorder);
    for (const background of [fieldStyle().backgroundColor, colors.background]) {
      expect(contrastRatio(fieldStyle().borderColor, background)).toBeGreaterThanOrEqual(3);
    }
    fireEvent(field(), 'blur');
    expect(fieldStyle().borderColor).toBe(restingBorder);
  });
  it.each([true, false])('keeps checked=%s glyph, label and boundary legible with checkbox semantics', (checked) => {
    apply(theme);
    render(<Toggle label="Favorite" checked={checked} onPress={jest.fn()} />);
    const toggle = screen.getByRole('checkbox', { name: 'Favorite' });
    const row = StyleSheet.flatten(toggle.props.style);
    const title = screen.getByText(`${checked ? '✓' : '○'} Favorite`);
    const text = StyleSheet.flatten(title.props.style);
    expect(toggle.props.accessibilityState).toEqual({ checked, disabled: false });
    // Invoke inside a React render to inspect the public Pressable boundary;
    // native rendering consumes this alias before exposing its host props.
    const boundary = renderHook(() => Toggle({ label: 'Favorite', checked, onPress: jest.fn() }));
    expect(boundary.result.current.props['aria-checked']).toBe(checked);
    expect(row.backgroundColor).toBe(checked ? colors.primarySoft : colors.surface);
    expect(contrastRatio(text.color, row.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    for (const background of [row.backgroundColor, colors.surface, colors.background]) {
      expect(contrastRatio(row.borderColor, background)).toBeGreaterThanOrEqual(3);
    }
  });
  it('keeps recipe form help text readable', () => {
    apply(theme); render(<Copy text="Paste a recipe URL" />);
    const color = StyleSheet.flatten(screen.getByText('Paste a recipe URL').props.style).color;
    expect(color).toBe(colors.textSubtle);
    for (const background of [colors.surface, colors.background]) {
      expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

it('updates mounted controls when the runtime theme changes, including a focused input', () => {
  function ThemeControl() {
    const { setTheme } = useTheme();
    return <Toggle label="Dark theme" checked={false} onPress={() => setTheme('orbit-club')} />;
  }
  apply('paper-pine');
  render(<ThemeProvider><Field label="Recipe title" value="Soup" onChange={jest.fn()} /><Toggle label="Favorite" checked onPress={jest.fn()} /><ThemeControl /></ThemeProvider>);
  fireEvent(field(), 'focus');
  fireEvent.press(screen.getByRole('checkbox', { name: 'Dark theme' }));
  expect(fieldStyle().color).toBe(colors.text);
  expect(fieldStyle().backgroundColor).toBe(colors.surface);
  expect(field().props.placeholderTextColor).toBe(colors.textSubtle);
  expect(StyleSheet.flatten(screen.getByText('Recipe title').props.style).color).toBe(colors.text);
  expect(StyleSheet.flatten(screen.getByRole('checkbox', { name: 'Favorite' }).props.style).backgroundColor).toBe(colors.primarySoft);
});

it('preserves input behavior and disabled checkbox state', () => {
  const change = jest.fn();
  const press = jest.fn();
  const view = render(<><Field label="Recipe URL" value="" onChange={change} /><Field label="Servings" value="4" onChange={change} numeric multiline disabled /><Toggle label="Favorite" checked disabled onPress={press} /></>);
  fireEvent.changeText(screen.getByLabelText('Recipe URL'), 'https://example.com/soup');
  expect(change).toHaveBeenCalledWith('https://example.com/soup');
  expect(screen.getByLabelText('Recipe URL').props.autoCapitalize).toBe('none');
  const servings = screen.getByLabelText('Servings');
  expect(servings.props.keyboardType).toBe('decimal-pad');
  expect(servings.props.multiline).toBe(true);
  expect(servings.props.editable).toBe(false);
  const toggle = screen.getByRole('checkbox', { name: 'Favorite' });
  expect(toggle.props.accessibilityState).toEqual({ checked: true, disabled: true });
  expect(toggle).toBeDisabled();
  expect(press).not.toHaveBeenCalled();
  view.unmount();
  render(<Toggle label="Favorite" checked={false} onPress={press} />);
  fireEvent.press(screen.getByRole('checkbox', { name: 'Favorite' }));
  expect(press).toHaveBeenCalledTimes(1);
});
