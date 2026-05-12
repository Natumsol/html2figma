import type { Html2FigmaDocument } from "html2figma";

export type CaptureTarget = "page" | "selection";

export interface StartSelectionMessage {
  type: "start-selection";
}

export interface CancelSelectionMessage {
  type: "cancel-selection";
}

export interface ConvertPageMessage {
  type: "convert-page";
}

export interface ConversionCompleteMessage {
  type: "conversion-complete";
  target: CaptureTarget;
  document: Html2FigmaDocument;
}

export interface GetLatestDocumentMessage {
  type: "get-latest-document";
}

export type ExtensionMessage =
  | StartSelectionMessage
  | CancelSelectionMessage
  | ConvertPageMessage
  | ConversionCompleteMessage
  | GetLatestDocumentMessage;
