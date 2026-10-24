import { afterEach, describe, expect, it } from "@jest/globals";
import { applyThemeColors, colors, themeIds } from "./colors";
import { formStyles, refreshFormStyles } from "./forms";

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(foreground: string, background: string) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
afterEach(() => { applyThemeColors("paper-pine"); refreshFormStyles(); });
describe("theme-aware form controls", () => {
  it.each(themeIds)("uses readable theme colors in %s", (theme) => {
    applyThemeColors(theme); refreshFormStyles();
    expect(formStyles.input.color).toBe(colors.text);
    expect(formStyles.fieldLabel.color).toBe(colors.text);
    expect(formStyles.selectableRowSelected.backgroundColor).toBe(colors.primarySoft);
    expect(contrast(colors.text, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.text, colors.primarySoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textMuted, colors.surfaceSoft)).toBeGreaterThanOrEqual(4.5);
  });
});
