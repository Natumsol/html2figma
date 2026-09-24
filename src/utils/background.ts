export type ParsedBackgroundImage =
  | { kind: "none" }
  | { kind: "url"; url: string }
  | { kind: "unsupported"; reason: "gradient" | "multiple" | "unknown" };

export function parseBackgroundImage(value: string): ParsedBackgroundImage {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none") {
    return { kind: "none" };
  }

  if (hasTopLevelComma(trimmed)) {
    return { kind: "unsupported", reason: "multiple" };
  }

  if (/\b(?:linear|radial|conic)-gradient\(/i.test(trimmed)) {
    return { kind: "unsupported", reason: "gradient" };
  }

  const match = trimmed.match(/^url\(\s*(['"]?)(.*?)\1\s*\)$/i);
  if (match?.[2]) {
    return { kind: "url", url: match[2].trim() };
  }

  return { kind: "unsupported", reason: "unknown" };
}

export function imageMimeType(source: string): string | undefined {
  const embedded = /^data:(image\/[a-z0-9.+-]+)(?:;|,)/i.exec(source);
  if (embedded) return embedded[1]!.toLowerCase();
  const path = source.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".png")) {
    return "image/png";
  }
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (path.endsWith(".gif")) {
    return "image/gif";
  }
  if (path.endsWith(".webp")) {
    return "image/webp";
  }
  if (path.endsWith(".svg")) {
    return "image/svg+xml";
  }

  return undefined;
}

function hasTopLevelComma(value: string): boolean {
  let depth = 0;
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) return true;
  }
  return false;
}
