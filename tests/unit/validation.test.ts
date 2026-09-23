import { describe, expect, it } from "vitest";
import { isHtml2FigmaDocument } from "../../src";
import type { Html2FigmaDocument } from "../../src";

function documentFixture(): Html2FigmaDocument {
  return {
    version: 1,
    root: { id: "root", type: "frame", name: "Root", bounds: { x: -20, y: 0, width: 100, height: 80 }, style: {}, source: { tagName: "div", path: "div" }, warnings: [], children: [] },
    resources: [], warnings: [], metadata: { viewport: { width: 800, height: 600 }, createdAt: "2026-09-23T00:00:00.000Z" }
  };
}

describe("document validation", () => {
  it("accepts negative positions and zero-size bounds", () => {
    const document = documentFixture();
    document.root.bounds.width = 0;
    expect(isHtml2FigmaDocument(document)).toBe(true);
  });
  it("rejects negative dimensions", () => {
    const document = documentFixture();
    document.root.bounds.width = -1;
    expect(isHtml2FigmaDocument(document)).toBe(false);
  });
  it.each([
    { opacity: 1.1 },
    { text: { fontFamily: "Inter", fontSize: 16, fontWeight: 400, textCase: "invalid" } },
    { cornerRadius: { topLeft: -1, topRight: 0, bottomLeft: 0, bottomRight: 0 } }
  ])("rejects invalid style values: %j", style => {
    const document = { ...documentFixture(), root: { ...documentFixture().root, style } };
    expect(isHtml2FigmaDocument(document)).toBe(false);
  });
  it("rejects dangling and mismatched image references", () => {
    const document = documentFixture();
    document.root.style.fills = [{ type: "image", resourceId: "photo", opacity: 1, scaleMode: "fill" }];
    expect(isHtml2FigmaDocument(document)).toBe(false);
    document.resources = [{ id: "photo", type: "svg", source: "svg", data: "<svg/>" }];
    expect(isHtml2FigmaDocument(document)).toBe(false);
    document.resources = [{ id: "photo", type: "image", source: "data:image/png;base64,AA==" }];
    expect(isHtml2FigmaDocument(document)).toBe(true);
  });
  it("rejects duplicate resource and node identifiers", () => {
    const document = documentFixture();
    const resource = { id: "photo", type: "image" as const, source: "photo.png" };
    document.resources = [resource, { ...resource }];
    expect(isHtml2FigmaDocument(document)).toBe(false);
    document.resources = [];
    document.root.children.push({ ...document.root, children: [] });
    expect(isHtml2FigmaDocument(document)).toBe(false);
  });
});
