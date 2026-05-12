import type { Html2FigmaDocument } from "html2figma";
import { isHtml2FigmaDocument } from "./shared/document";

export interface RenderBlockMessage {
  type: "render-block";
  blockId: string;
  document: Html2FigmaDocument;
}

export interface RenderJsonMessage {
  type: "render-json";
  source: "paste" | "file";
  document: Html2FigmaDocument;
}

export type UiToPluginMessage = RenderBlockMessage | RenderJsonMessage;

export function isUiToPluginMessage(value: unknown): value is UiToPluginMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type === "render-block") {
    return (
      typeof value.blockId === "string" &&
      isHtml2FigmaDocument(value.document)
    );
  }

  if (value.type === "render-json") {
    return (
      (value.source === "paste" || value.source === "file") &&
      isHtml2FigmaDocument(value.document)
    );
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
