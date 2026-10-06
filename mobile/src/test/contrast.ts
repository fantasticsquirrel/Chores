// WCAG 2.x sRGB relative luminance; assertions use unrounded ratios.
export function contrastRatio(foreground: string, background: string): number {
  function luminance(hex: string): number {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Expected opaque sRGB color, received ${hex}`);
    const [red, green, blue] = [1, 3, 5].map((offset) => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  }
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
