import type { Html2FigmaDocument, Html2FigmaNode } from "html2figma";

export interface DocumentSummary {
  rootName: string;
  rootType: string;
  nodeCount: number;
  resourceCount: number;
  warningCount: number;
  bounds: string;
}

export function summarizeDocument(document: Html2FigmaDocument): DocumentSummary {
  return {
    rootName: document.root.name,
    rootType: document.root.type,
    nodeCount: countNodes(document.root),
    resourceCount: document.resources.length,
    warningCount: document.warnings.length,
    bounds: `${Math.round(document.root.bounds.width)}x${Math.round(document.root.bounds.height)}`
  };
}

export function makeDownloadFilename(date = new Date()): string {
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  return `html2figma-${stamp}.json`;
}

function countNodes(node: Html2FigmaNode): number {
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
}
