import { render } from 'html2figma/render';
import { isHtml2FigmaDocument } from 'html2figma';

declare const __html__: string;
declare const __LIBRARY_VERSION__: string;
figma.showUI(__html__, { width: 520, height: 580 });
let busy = false;
figma.ui.onmessage = async (message: unknown) => {
  if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== 'render' || !('document' in message)) return;
  if (busy) return;
  if (!isHtml2FigmaDocument(message.document)) {
    figma.ui.postMessage({ type: 'error', message: 'Invalid html2figma JSON.' });
    return;
  }
  busy = true;
  try {
    const result = await render(message.document, { parent: figma.currentPage, loadFonts: true });
    figma.currentPage.selection = [result.root];
    figma.viewport.scrollAndZoomIntoView([result.root]);
    figma.ui.postMessage({ type: 'done', nodes: result.nodes.length, warnings: result.warnings });
    figma.notify(`html2figma ${__LIBRARY_VERSION__}: created ${result.nodes.length} layers`);
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Render failed' });
  } finally { busy = false; }
};
