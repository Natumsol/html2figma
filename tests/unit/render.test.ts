import { describe, expect, it } from "vitest";
import type { Html2FigmaDocument } from "../../src";
import type { FigmaAdapter, RenderableNode } from "../../src/render/adapter";
import { renderWithAdapter } from "../../src/render/create-node";

class FakeAdapter implements FigmaAdapter {
  currentPage: RenderableNode = {
    type: "PAGE",
    children: []
  };

  createdTypes: string[] = [];
  rejectFontFamily?: string;

  createFrame(): RenderableNode {
    return this.createNode("FRAME");
  }

  createRectangle(): RenderableNode {
    return this.createNode("RECTANGLE");
  }

  createText(): RenderableNode {
    return this.createNode("TEXT");
  }

  createNodeFromSvg(): RenderableNode {
    return this.createNode("SVG");
  }

  appendChild(parent: RenderableNode, child: RenderableNode): void {
    parent.children ??= [];
    parent.children.push(child);
  }

  async loadFontAsync(fontName: FontName): Promise<void> {
    if (fontName.family === this.rejectFontFamily) {
      throw new Error("Font unavailable");
    }

    return;
  }

  async createImageAsync(): Promise<string> {
    return "image-hash";
  }

  private createNode(type: string): RenderableNode {
    this.createdTypes.push(type);
    return {
      type,
      children: []
    };
  }
}

describe("renderWithAdapter", () => {
  it("renders a frame root with a text child through an adapter", async () => {
    const document: Html2FigmaDocument = {
      version: 1,
      root: {
        id: "root",
        type: "frame",
        name: "Root Frame",
        bounds: {
          x: 0,
          y: 0,
          width: 320,
          height: 200
        },
        style: {},
        source: {
          tagName: "div",
          path: "html > body > div"
        },
        warnings: [],
        children: [
          {
            id: "text-1",
            type: "text",
            name: "Greeting",
            text: "Hello Figma",
            bounds: {
              x: 16,
              y: 24,
              width: 120,
              height: 24
            },
            style: {
              text: {
                fontFamily: "Inter",
                fontSize: 16,
                fontWeight: 400,
                color: {
                  r: 32,
                  g: 32,
                  b: 32
                }
              }
            },
            source: {
              tagName: "span",
              path: "html > body > div > span"
            },
            warnings: [],
            children: []
          }
        ]
      },
      resources: [],
      warnings: [],
      metadata: {
        viewport: {
          width: 320,
          height: 200
        },
        createdAt: "2026-05-10T00:00:00.000Z"
      }
    };
    const adapter = new FakeAdapter();

    const result = await renderWithAdapter(document, adapter);
    const root = result.root as unknown as RenderableNode;

    expect(result.root.type).toBe("FRAME");
    expect(adapter.createdTypes).toEqual(["FRAME", "TEXT"]);
    expect(root.children).toHaveLength(1);
    expect(adapter.currentPage.children).toEqual([root]);
    expect(result.warnings).toEqual([]);
  });

  it("uses the fallback font when the requested font fails to load", async () => {
    const document = createDocument({
      root: createTextNode({
        style: {
          text: {
            fontFamily: "Unavailable",
            fontSize: 16,
            fontWeight: 400
          }
        }
      })
    });
    const adapter = new FakeAdapter();
    adapter.rejectFontFamily = "Unavailable";

    const result = await renderWithAdapter(document, adapter);
    const root = result.root as unknown as RenderableNode;

    expect(result.warnings.some((warning) => warning.code === "font-load-failed")).toBe(
      true
    );
    expect(root.fontName).toEqual({
      family: "Inter",
      style: "Regular"
    });
  });

  it("does not apply box and layout styles to text nodes", async () => {
    const document = createDocument({
      root: createTextNode({
        style: {
          fills: [
            {
              type: "solid",
              color: {
                r: 255,
                g: 0,
                b: 0
              },
              opacity: 0.5
            }
          ],
          strokes: [
            {
              color: {
                r: 0,
                g: 0,
                b: 0
              },
              opacity: 1,
              weight: 2,
              align: "inside"
            }
          ],
          effects: [
            {
              type: "drop-shadow",
              color: {
                r: 0,
                g: 0,
                b: 0
              },
              opacity: 0.25,
              offsetX: 0,
              offsetY: 4,
              blur: 12,
              spread: 0
            }
          ],
          cornerRadius: {
            topLeft: 8,
            topRight: 8,
            bottomRight: 8,
            bottomLeft: 8
          },
          layout: {
            mode: "horizontal",
            gap: 8,
            padding: {
              top: 12,
              right: 12,
              bottom: 12,
              left: 12
            },
            primaryAxisAlignItems: "center",
            counterAxisAlignItems: "center",
            wraps: false
          },
          text: {
            fontFamily: "Inter",
            fontSize: 16,
            fontWeight: 400,
            color: {
              r: 32,
              g: 32,
              b: 32
            }
          }
        }
      })
    });
    const adapter = new FakeAdapter();

    const result = await renderWithAdapter(document, adapter);
    const root = result.root as unknown as RenderableNode;

    expect(root.layoutMode).toBeUndefined();
    expect(root.paddingTop).toBeUndefined();
    expect(root.topLeftRadius).toBeUndefined();
    expect(root.effects).toBeUndefined();
    expect(root.strokes).toBeUndefined();
    expect(root.fills).toEqual([
      {
        type: "SOLID",
        color: {
          r: 32 / 255,
          g: 32 / 255,
          b: 32 / 255
        },
        opacity: 1
      }
    ]);
  });

  it("warns and falls back to a frame when svg resource data is missing", async () => {
    const document = createDocument({
      root: {
        id: "svg-1",
        type: "svg",
        name: "Icon",
        resourceId: "missing-svg",
        bounds: {
          x: 0,
          y: 0,
          width: 24,
          height: 24
        },
        style: {},
        source: {
          tagName: "svg",
          path: "html > body > svg"
        },
        warnings: [],
        children: []
      }
    });
    const adapter = new FakeAdapter();

    const result = await renderWithAdapter(document, adapter);

    expect(result.root.type).toBe("FRAME");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "missing-svg-resource",
        nodeId: "svg-1"
      })
    );
  });
});

function createDocument(
  overrides: Partial<Html2FigmaDocument> & Pick<Html2FigmaDocument, "root">
): Html2FigmaDocument {
  return {
    version: 1,
    resources: [],
    warnings: [],
    metadata: {
      viewport: {
        width: 320,
        height: 200
      },
      createdAt: "2026-05-10T00:00:00.000Z"
    },
    ...overrides
  };
}

function createTextNode(
  overrides: Partial<Extract<Html2FigmaDocument["root"], { type: "text" }>> = {}
): Extract<Html2FigmaDocument["root"], { type: "text" }> {
  return {
    id: "text-1",
    type: "text",
    name: "Greeting",
    text: "Hello Figma",
    bounds: {
      x: 16,
      y: 24,
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
      tagName: "span",
      path: "html > body > span"
    },
    warnings: [],
    children: [],
    ...overrides
  };
}
