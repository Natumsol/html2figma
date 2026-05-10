const PX_LENGTH_RE = /^(-?(?:\d+|\d*\.\d+))px$/i;

export function parsePx(value: string): number | undefined {
  const match = value.trim().match(PX_LENGTH_RE);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalPx(value: string, fallback = 0): number {
  return parsePx(value) ?? fallback;
}
