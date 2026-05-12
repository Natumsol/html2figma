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

  const label =
    message.type === "render-block"
      ? message.blockId
      : `imported ${message.source} JSON`;

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

    figma.notify(`Rendered ${label}${warningText}`);
  } catch (error) {
    console.error("Failed to render html2figma document", error);
    figma.notify(`Failed to render ${label}`);
  }
};
