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
