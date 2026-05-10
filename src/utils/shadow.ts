import type { AstShadow } from "../schema/types";
import { parseCssColor } from "./color";
import { parsePx } from "./length";

const COLOR_FUNCTION_RE = /rgba?\([^)]*\)/i;

function splitShadowList(value: string): string[] {
  const shadows: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(0, depth - 1);
    } else if (character === "," && depth === 0) {
      shadows.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  shadows.push(value.slice(start).trim());
  return shadows.filter(Boolean);
}

function parseSingleShadow(value: string): AstShadow | undefined {
  if (/\binset\b/i.test(value)) {
    return undefined;
  }

  const colorMatch = value.match(COLOR_FUNCTION_RE);
  if (!colorMatch) {
    return undefined;
  }

  const parsedColor = parseCssColor(colorMatch[0]);
  if (!parsedColor) {
    return undefined;
  }

  const valueWithoutColor = value.replace(colorMatch[0], " ");
  const lengthTokens = valueWithoutColor
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const lengths = lengthTokens.map(parsePx);
  if (lengths.some((length) => length === undefined)) {
    return undefined;
  }

  if (lengths.length < 2) {
    return undefined;
  }

  return {
    type: "drop-shadow",
    color: parsedColor.color,
    opacity: parsedColor.opacity,
    offsetX: lengths[0] ?? 0,
    offsetY: lengths[1] ?? 0,
    blur: lengths[2] ?? 0,
    spread: lengths[3] ?? 0
  };
}

export function parseBoxShadow(value: string): AstShadow[] {
  if (value.trim().toLowerCase() === "none") {
    return [];
  }

  return splitShadowList(value).flatMap((shadow) => {
    const parsed = parseSingleShadow(shadow);
    return parsed ? [parsed] : [];
  });
}
