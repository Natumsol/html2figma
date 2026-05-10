import type { Rgb } from "../schema/types";

export interface ParsedCssColor {
  color: Rgb;
  opacity: number;
}

const RGB_FUNCTION_RE = /^rgba?\((.*)\)$/i;
const NUMERIC_COMPONENT_RE = /^-?(?:\d+|\d*\.\d+)$/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeChannel(value: number): number {
  return clamp(value, 0, 255) / 255;
}

export function parseCssColor(value: string): ParsedCssColor | undefined {
  const trimmed = value.trim();

  if (trimmed.toLowerCase() === "transparent") {
    return undefined;
  }

  const match = trimmed.match(RGB_FUNCTION_RE);
  if (!match) {
    return undefined;
  }

  const parts = match[1]?.split(",").map((part) => part.trim()) ?? [];
  if (parts.length !== 3 && parts.length !== 4) {
    return undefined;
  }

  if (!parts.every((part) => NUMERIC_COMPONENT_RE.test(part))) {
    return undefined;
  }

  const [red, green, blue] = parts.slice(0, 3).map(Number);
  const rawOpacity = parts[3] === undefined ? 1 : Number(parts[3]);
  if (
    red === undefined ||
    green === undefined ||
    blue === undefined ||
    !Number.isFinite(red) ||
    !Number.isFinite(green) ||
    !Number.isFinite(blue) ||
    !Number.isFinite(rawOpacity)
  ) {
    return undefined;
  }

  const opacity = clamp(rawOpacity, 0, 1);
  if (opacity === 0) {
    return undefined;
  }

  return {
    color: {
      r: normalizeChannel(red),
      g: normalizeChannel(green),
      b: normalizeChannel(blue)
    },
    opacity
  };
}
