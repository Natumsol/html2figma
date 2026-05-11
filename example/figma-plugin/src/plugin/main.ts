import { render } from "html2figma/render";
import exampleConfig from "../../example.config";
import { isUiToPluginMessage } from "../messages";
import { createUiShellHtml } from "./ui-shell";

figma.showUI(createUiShellHtml(exampleConfig.uiDevUrl), {
  width: exampleConfig.uiWidth,
  height: exampleConfig.uiHeight
});

figma.ui.onmessage = async (message: unknown) => {
  if (!isUiToPluginMessage(message)) {
    return;
  }

  try {
    const result = await render(message.document, {
      parent: figma.currentPage,
      loadFonts: true
    });

    figma.currentPage.selection = [result.root];
    figma.viewport.scrollAndZoomIntoView([result.root]);

    const warningText =
      result.warnings.length === 0
        ? ""
        : ` with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`;

    figma.notify(`Rendered ${message.blockId}${warningText}`);
  } catch (error) {
    console.error("Failed to render html2figma block", error);
    figma.notify(`Failed to render ${message.blockId}`);
  }
};
