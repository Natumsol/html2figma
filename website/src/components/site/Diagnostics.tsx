import type { ConvertWarning } from "html2figma";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { t, type Language } from "@/lib/i18n";
const explanations: Record<string, [string, string]> = {
  "unsupported-css-grid": [
    "Grid has no matching Figma layout. Check measured positioning in the plugin.",
    "Grid 没有对应的 Figma 布局，请在插件中检查测量后的位置。",
  ],
  "unsupported-transform": [
    "CSS transforms are not reproduced as Figma transforms.",
    "CSS 变换无法还原为对应的 Figma 变换。",
  ],
  "flex-layout-fallback": [
    "This flex layout uses measured positions instead of Auto Layout.",
    "此 Flex 布局使用测量位置，未创建 Auto Layout。",
  ],
  "unsupported-background-image": [
    "The background uses an unsupported gradient or multiple layers.",
    "背景使用了未支持的渐变或多层图像。",
  ],
  "font-load-failed": [
    "The requested font is unavailable in Figma; a fallback was used.",
    "Figma 无法加载所需字体，已使用回退字体。",
  ],
  "unsupported-border-style": [
    "This border style cannot be faithfully reproduced.",
    "此边框样式无法忠实还原。",
  ],
};
export function Diagnostics({
  warnings,
  resources,
  language,
  empty,
}: {
  warnings: ConvertWarning[];
  resources: string[];
  language: Language;
  empty?: string;
}) {
  if (!warnings.length && !resources.length)
    return (
      <p className="diagnostic-empty">
        {empty ||
          t(
            language,
            "No conversion warnings. Check fonts and visual output in Figma.",
            "没有转换警告，请在 Figma 中检查字体与视觉效果。",
          )}
      </p>
    );
  return (
    <>
      {warnings.map((warning, index) => (
        <Alert
          key={`${warning.code}-${index}`}
          className="diagnostic-item w-auto border-0 bg-[#fff7ed] text-[#695342]"
        >
          <AlertTitle>
            <code>{warning.code}</code>
          </AlertTitle>
          <AlertDescription>
            <p>
              {explanations[warning.code]
                ? t(language, ...explanations[warning.code]!)
                : warning.message}
            </p>
            <small>
              {[warning.nodeId, warning.cssProperty, warning.source]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </AlertDescription>
        </Alert>
      ))}
      {resources.map((resource, index) => (
        <Alert
          key={index}
          className="diagnostic-item w-auto border-0 bg-[#fff7ed]"
        >
          <AlertTitle>
            <code>{t(language, "Resource loading", "资源加载")}</code>
          </AlertTitle>
          <AlertDescription>
            <p>{resource}</p>
          </AlertDescription>
        </Alert>
      ))}
    </>
  );
}
