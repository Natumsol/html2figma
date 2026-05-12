import { describe, expect, it } from "vitest";
import type { Html2FigmaDocument } from "html2figma";
import { makeDownloadFilename, summarizeDocument } from "./document";

const documentFixture: Html2FigmaDocument = {
  version: 1,
  root: {
    id: "node-1",
    type: "frame",
    name: "Selected Card",
    bounds: { x: 0, y: 0, width: 240, height: 120 },
    style: {},
    source: { tagName: "div", path: "html > body > div" },
    warnings: [],
    children: []
  },
  resources: [
    { id: "resource-1", type: "image", source: "https://example.com/image.png" }
  ],
  warnings: [],
  metadata: {
    viewport: { width: 1440, height: 900 },
    createdAt: "2026-05-11T00:00:00.000Z"
  }
};

describe("extension document helpers", () => {
  it("summarizes captured documents", () => {
    expect(summarizeDocument(documentFixture)).toEqual({
      rootName: "Selected Card",
      rootType: "frame",
      nodeCount: 1,
      resourceCount: 1,
      warningCount: 0,
      bounds: "240x120"
    });
  });

  it("creates stable download filenames", () => {
    expect(makeDownloadFilename(new Date("2026-05-11T10:20:30.000Z"))).toBe(
      "html2figma-20260511-102030.json"
    );
  });
});
