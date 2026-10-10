import source from "./generated/cases.json";
import { t, type Language } from "../lib/i18n";

export const cases = source;
const translations: Record<string, [string, string, string, string]> = {
  "hero-section": [
    "Hero section",
    "首页首屏",
    "Typography, solid fills and rounded corners.",
    "验证文字排版、纯色填充与圆角。",
  ],
  "icon-feature-card": [
    "Feature card",
    "功能卡片",
    "Inline SVG and a simple flex layout.",
    "验证内联 SVG 与简单 Flex 布局。",
  ],
  "pricing-card": [
    "Pricing card",
    "定价卡片",
    "Editable text and a composed card layout. Sample pricing only.",
    "验证可编辑文本与卡片布局，价格仅为示例。",
  ],
  "profile-media-card": [
    "Profile card",
    "个人资料卡片",
    "Embedded image, inline SVG and text.",
    "验证内嵌图片、内联 SVG 与文本。",
  ],
  "image-product-card": [
    "Image card",
    "图片卡片",
    "A self-contained image with object-fit.",
    "验证内嵌图片与 object-fit。",
  ],
  "stats-panel": [
    "Statistics panel",
    "统计面板",
    "Text, spacing and measured geometry. Illustrative values.",
    "验证文本、间距与测量后的几何信息，数据仅为示例。",
  ],
};
export function caseText(id: string, language: Language) {
  const entry = translations[id];
  if (!entry) throw new Error(`Missing case translation: ${id}`);
  return {
    title: t(language, entry[0], entry[1]),
    description: t(language, entry[2], entry[3]),
  };
}

export const caseFeatures: Record<string, string[]> = {
  "hero-section": ["Text", "Fills", "Radius"],
  "icon-feature-card": ["SVG", "Flex", "Text"],
  "pricing-card": ["Text", "Spacing", "Shadow"],
  "profile-media-card": ["Image", "SVG", "Flex"],
  "image-product-card": ["Image", "Object-fit"],
  "stats-panel": ["Text", "Geometry", "Spacing"],
};
