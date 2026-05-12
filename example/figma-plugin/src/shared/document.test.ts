import { describe, expect, it } from "vitest";
import type { Html2FigmaDocument } from "html2figma";
import {
  isHtml2FigmaDocument,
  parseDocumentJson,
  summarizeDocument
} from "./document";

describe("document helpers", () => {
  it("parses a valid document fixture", () => {
    const document = createDocument();

    expect(parseDocumentJson(JSON.stringify(document))).toEqual(document);
  });

  it("rejects invalid JSON with a parse error message", () => {
    expect(catchError(() => parseDocumentJson("{")).message).toBe(
      "JSON could not be parsed."
    );
  });

  it("rejects invalid document shape with a validation error message", () => {
    expect(
      catchError(() => parseDocumentJson(JSON.stringify({ version: 1 }))).message
    ).toBe("JSON is not a valid html2figma document.");
  });

  it("summarizes a document with child node counts and viewport size", () => {
    const document = createDocument({
      root: createFrameNode({
        children: [createTextNode()]
      })
    });

    expect(summarizeDocument(document)).toEqual({
      version: 1,
      rootName: "Root",
      rootType: "frame",
      nodeCount: 2,
      resourceCount: 0,
      warningCount: 0,
      viewport: "1280x720"
    });
  });

  it("rejects text nodes missing text content", () => {
    const root = { ...createTextNode() } as Record<string, unknown>;
    delete root.text;
    const document = {
      ...createDocument(),
      root
    };

    expect(isHtml2FigmaDocument(document)).toBe(false);
  });

  it("rejects non-finite bounds", () => {
    const document = createDocument({
      root: createFrameNode({
        bounds: {
          x: 0,
          y: 0,
          width: Number.POSITIVE_INFINITY,
          height: 720
        }
      })
    });

    expect(isHtml2FigmaDocument(document)).toBe(false);
  });

  it("rejects malformed style fill entries", () => {
    const root = { ...createFrameNode() } as Record<string, unknown>;
    root.style = {
      fills: [1]
    };
    const document = {
      ...createDocument(),
      root
    };

    expect(isHtml2FigmaDocument(document)).toBe(false);
  });

  it("rejects malformed resource entries", () => {
    const document = {
      ...createDocument(),
      resources: [
        {
          id: "resource-1",
          type: "video",
          source: "/media/example.mp4"
        }
      ]
    };

    expect(isHtml2FigmaDocument(document)).toBe(false);
  });

  it("rejects malformed warning entries", () => {
    const document = {
      ...createDocument(),
      warnings: [
        {
          code: "unsupported-css",
          message: "Unsupported CSS",
          severity: "critical"
        }
      ]
    };

    expect(isHtml2FigmaDocument(document)).toBe(false);
  });

  it("rejects malformed optional metadata fields", () => {
    const document = {
      ...createDocument(),
      metadata: {
        viewport: {
          width: 1280,
          height: 720
        },
        createdAt: 123,
        sourceUrl: 456
      }
    };

    expect(isHtml2FigmaDocument(document)).toBe(false);
  });
});

function createDocument(
  overrides: Partial<Html2FigmaDocument> = {}
): Html2FigmaDocument {
  return {
    version: 1,
    root: createFrameNode(),
    resources: [],
    warnings: [],
    metadata: {
      viewport: {
        width: 1280,
        height: 720
      },
      createdAt: "2026-05-12T00:00:00.000Z"
    },
    ...overrides
  };
}

function catchError(callback: () => unknown): Error {
  try {
    callback();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
  }

  throw new Error("Expected callback to throw an Error.");
}

function createFrameNode(
  overrides: Partial<Extract<Html2FigmaDocument["root"], { type: "frame" }>> = {}
): Extract<Html2FigmaDocument["root"], { type: "frame" }> {
  return {
    id: "node-1",
    type: "frame",
    name: "Root",
    bounds: {
      x: 0,
      y: 0,
      width: 1280,
      height: 720
    },
    style: {},
    source: {
      tagName: "body",
      path: "html > body"
    },
    warnings: [],
    children: [],
    ...overrides
  };
}

function createTextNode(
  overrides: Partial<Extract<Html2FigmaDocument["root"], { type: "text" }>> = {}
): Extract<Html2FigmaDocument["root"], { type: "text" }> {
  return {
    id: "node-2",
    type: "text",
    name: "Title",
    text: "Hello",
    bounds: {
      x: 24,
      y: 32,
      width: 120,
      height: 24
    },
    style: {
      text: {
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 400
      }
    },
    source: {
      tagName: "h1",
      path: "html > body > h1"
    },
    warnings: [],
    children: [],
    ...overrides
  };
}
