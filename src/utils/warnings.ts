import type { ConvertWarning, WarningSeverity } from "../schema/types";

export function createWarning(
  code: string,
  message: string,
  severity: WarningSeverity = "warning",
  extra: Omit<Partial<ConvertWarning>, "code" | "message" | "severity"> = {}
): ConvertWarning {
  return {
    code,
    message,
    severity,
    ...extra
  };
}

/** Documents aggregate node warnings; JSON transport does not preserve identity. */
export function uniqueWarnings(warnings: ConvertWarning[]): ConvertWarning[] {
  const seen = new Set<string>();
  return warnings.filter(warning => {
    const key = JSON.stringify([
      warning.code, warning.message, warning.severity,
      warning.nodeId, warning.cssProperty, warning.source
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
