import type { Html2FigmaDocument } from "html2figma";
export { parseDocumentJson, isHtml2FigmaDocument } from "html2figma";

export interface DocumentSummary {
  version: Html2FigmaDocument["version"];
  rootName: string;
  rootType: Html2FigmaDocument["root"]["type"];
  nodeCount: number;
  resourceCount: number;
  warningCount: number;
  viewport: string;
}

export function summarizeDocument(
  document: Html2FigmaDocument
): DocumentSummary {
  return {
    version: document.version,
    rootName: document.root.name,
    rootType: document.root.type,
    nodeCount: countNodes(document.root),
    resourceCount: document.resources.length,
    warningCount: document.warnings.length,
    viewport: `${document.metadata.viewport.width}x${document.metadata.viewport.height}`
  };
}

function countNodes(node: Html2FigmaDocument["root"]): number {
  return 1 + node.children.reduce((count, child) => count + countNodes(child), 0);
}
