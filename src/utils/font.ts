const FONT_WEIGHT_KEYWORDS: Record<string, number> = {
  thin: 100,
  extralight: 200,
  "extra-light": 200,
  ultralight: 200,
  "ultra-light": 200,
  light: 300,
  normal: 400,
  regular: 400,
  medium: 500,
  semibold: 600,
  "semi-bold": 600,
  demibold: 600,
  "demi-bold": 600,
  bold: 700,
  extrabold: 800,
  "extra-bold": 800,
  ultrabold: 800,
  "ultra-bold": 800,
  black: 900,
  heavy: 900
};

export function firstFontFamily(fontFamily: string): string {
  const first = fontFamily.split(",")[0]?.trim() ?? "";
  return first.replace(/^["']|["']$/g, "");
}

export function normalizeFontWeight(value: string): number {
  const trimmed = value.trim().toLowerCase();
  const numeric = Number(trimmed);

  if (Number.isFinite(numeric)) {
    return Math.min(1000, Math.max(1, numeric));
  }

  return FONT_WEIGHT_KEYWORDS[trimmed] ?? 400;
}
