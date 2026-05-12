import type { Html2FigmaDocument } from "html2figma";
import type { ExtensionMessage } from "../shared/messages";

let latestDocument: Html2FigmaDocument | undefined;

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === "conversion-complete") {
      latestDocument = message.document;
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "get-latest-document") {
      sendResponse({ document: latestDocument });
      return true;
    }

    return false;
  }
);
