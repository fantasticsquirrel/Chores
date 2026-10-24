/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = existsSync("src/styles/tokens.css")
  ? process.cwd()
  : resolve(process.cwd(), "frontend");
const overrides = readFileSync(resolve(root, "src/overhaul.css"), "utf8");
const tokenStyles = readFileSync(
  resolve(root, "src/styles/tokens.css"),
  "utf8",
);

function declarations(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
}
function luminance(hex: string): number {
  const raw = hex.slice(1);
  const expanded =
    raw.length === 3 ? [...raw].map((digit) => digit + digit).join("") : raw;
  return [0, 2, 4]
    .map((index) => parseInt(expanded.slice(index, index + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}

it.each(["paper-pine", "clearline", "orbit-club"])(
  "keeps normal accent-button text above 4.5:1 in %s",
  (theme) => {
    const base = declarations(tokenStyles.match(/:root\s*\{([^}]+)\}/)![1]);
    const themeBlock = tokenStyles.match(
      new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`),
    );
    const tokens = {
      ...base,
      ...(themeBlock ? declarations(themeBlock[1]) : {}),
    };
    const button = declarations(
      overrides.match(/\.jewel-button\s*\{([^}]+)\}/)![1],
    );
    const resolve = (value: string) =>
      value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => tokens[name]);
    const levels = [
      luminance(resolve(button.color)),
      luminance(resolve(button.background)),
    ].sort((a, b) => a - b);
    expect((levels[1] + 0.05) / (levels[0] + 0.05)).toBeGreaterThanOrEqual(4.5);
  },
);

it.each(["paper-pine", "clearline", "orbit-club"])(
  "keeps keyboard focus above 3:1 on soft cards in %s",
  (theme) => {
    const base = declarations(tokenStyles.match(/:root\s*\{([^}]+)\}/)![1]);
    const themeBlock = tokenStyles.match(
      new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`),
    );
    const tokens = {
      ...base,
      ...(themeBlock ? declarations(themeBlock[1]) : {}),
    };
    const levels = [
      luminance(tokens["--ring-focus"]),
      luminance(tokens["--surface-soft"]),
    ].sort((a, b) => a - b);
    expect((levels[1] + 0.05) / (levels[0] + 0.05)).toBeGreaterThanOrEqual(3);
  },
);
