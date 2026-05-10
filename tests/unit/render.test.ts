import { describe, expect, it } from "vitest";
import type { Html2FigmaDocument } from "../../src";
import type { FigmaAdapter, RenderableNode } from "../../src/render/adapter";
import { applyBaseProperties } from "../../src/render/apply-style";
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
  it("resizes Figma-like nodes without assigning read-only width and height", () => {
    const node = {
      type: "FRAME",
      children: [],
      get width() {
        return 0;
      },
      get height() {
        return 0;
      },
      resize(width: number, height: number) {
        this.resizedTo = {
          width,
          height
        };
      }
    } as RenderableNode;

    applyBaseProperties(node, {
      id: "frame-1",
      type: "frame",
      name: "Frame",
      bounds: {
        x: 10,
        y: 20,
        width: 320,
        height: 180
      },
      style: {},
      source: {
        tagName: "div",
        path: "html > body > div"
      },
      warnings: [],
      children: []
    });

    expect(node.x).toBe(10);
    expect(node.y).toBe(20);
    expect(node.resizedTo).toEqual({
      width: 320,
      height: 180
    });
  });

  it("maps drop shadows to valid Figma effects", () => {
    const node: RenderableNode = {
      type: "FRAME",
      children: []
    };

    applyBaseProperties(node, {
      id: "frame-1",
      type: "frame",
      name: "Frame",
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 100
      },
      style: {
        effects: [
          {
            type: "drop-shadow",
            color: {
              r: 0,
              g: 0,
              b: 0
            },
            opacity: 0.2,
            offsetX: 0,
            offsetY: 8,
            blur: 24,
            spread: 0
          }
        ]
      },
      source: {
        tagName: "div",
        path: "html > body > div"
      },
      warnings: [],
      children: []
    });

    expect(node.effects).toEqual([
      {
        type: "DROP_SHADOW",
        color: {
          r: 0,
          g: 0,
          b: 0,
          a: 0.2
        },
        offset: {
          x: 0,
          y: 8
        },
        radius: 24,
        spread: 0,
        visible: true,
        blendMode: "NORMAL"
      }
    ]);
  });

  it("preserves normalized RGB channels from converted CSS", () => {
    const node: RenderableNode = {
      type: "FRAME",
      children: []
    };

    applyBaseProperties(node, {
      id: "frame-1",
      type: "frame",
      name: "Frame",
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 100
      },
      style: {
        fills: [
          {
            type: "solid",
            color: {
              r: 22 / 255,
              g: 32 / 255,
              b: 78 / 255
            },
            opacity: 1
          }
        ]
      },
      source: {
        tagName: "div",
        path: "html > body > div"
      },
      warnings: [],
      children: []
    });

    expect(node.fills).toEqual([
      {
        type: "SOLID",
        color: {
          r: 22 / 255,
          g: 32 / 255,
          b: 78 / 255
        },
        opacity: 1
      }
    ]);
  });

  it("clears default frame fills when the source has transparent background", () => {
    const node: RenderableNode = {
      type: "FRAME",
      children: [],
      fills: [
        {
          type: "SOLID",
          color: {
            r: 1,
            g: 1,
            b: 1
          },
          opacity: 1
        }
      ]
    };

    applyBaseProperties(node, {
      id: "frame-1",
      type: "frame",
      name: "Frame",
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 100
      },
      style: {},
      source: {
        tagName: "h1",
        path: "html > body > h1"
      },
      warnings: [],
      children: []
    });

    expect(node.fills).toEqual([]);
  });

  it("keeps flex frames fixed so space-between uses the source width", () => {
    const node: RenderableNode = {
      type: "FRAME",
      children: []
    };

    applyBaseProperties(node, {
      id: "frame-1",
      type: "frame",
      name: "Header",
      bounds: {
        x: 0,
        y: 0,
        width: 302,
        height: 28
      },
      style: {
        layout: {
          mode: "horizontal",
          gap: 16,
          padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          },
          primaryAxisAlignItems: "space-between",
          counterAxisAlignItems: "center",
          wraps: false
        }
      },
      source: {
        tagName: "div",
        path: "section > div"
      },
      warnings: [],
      children: []
    });

    expect(node.layoutMode).toBe("HORIZONTAL");
    expect(node.primaryAxisAlignItems).toBe("SPACE_BETWEEN");
    expect(node.primaryAxisSizingMode).toBe("FIXED");
    expect(node.counterAxisSizingMode).toBe("FIXED");
  });

  it("renders direct children of flex frames as auto-layout items", async () => {
    const document = createDocument({
      root: {
        id: "root",
        type: "frame",
        name: "Flex Row",
        bounds: {
          x: 0,
          y: 0,
          width: 320,
          height: 48
        },
        style: {
          layout: {
            mode: "horizontal",
            gap: 16,
            padding: {
              top: 0,
              right: 0,
              bottom: 0,
              left: 0
            },
            primaryAxisAlignItems: "space-between",
            counterAxisAlignItems: "center",
            wraps: false
          }
        },
        source: {
          tagName: "div",
          path: "section > div"
        },
        warnings: [],
        children: [
          createTextNode({
            id: "text-1",
            bounds: {
              x: 0,
              y: 16,
              width: 64,
              height: 16
            }
          }),
          {
            id: "badge-1",
            type: "frame",
            name: "Badge",
            bounds: {
              x: 260,
              y: 8,
              width: 60,
              height: 32
            },
            style: {},
            source: {
              tagName: "div",
              path: "section > div > div"
            },
            warnings: [],
            children: []
          }
        ]
      }
    });
    const adapter = new FakeAdapter();

    const result = await renderWithAdapter(document, adapter);
    const root = result.root as unknown as RenderableNode;
    const [label, badge] = root.children ?? [];

    expect(root.layoutMode).toBe("HORIZONTAL");
    expect(label?.layoutPositioning).toBe("AUTO");
    expect(label?.layoutSizingHorizontal).toBe("FIXED");
    expect(label?.layoutSizingVertical).toBe("FIXED");
    expect(badge?.layoutPositioning).toBe("AUTO");
    expect(badge?.layoutSizingHorizontal).toBe("FIXED");
    expect(badge?.layoutSizingVertical).toBe("FIXED");
  });

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

  it("renders child bounds relative to their parent frame", async () => {
    const document = createDocument({
      root: {
        id: "root",
        type: "frame",
        name: "Root",
        bounds: {
          x: 100,
          y: 200,
          width: 320,
          height: 180
        },
        style: {},
        source: {
          tagName: "section",
          path: "section"
        },
        warnings: [],
        children: [
          createTextNode({
            bounds: {
              x: 140,
              y: 260,
              width: 120,
              height: 32
            }
          })
        ]
      }
    });
    const adapter = new FakeAdapter();

    const result = await renderWithAdapter(document, adapter);
    const root = result.root as unknown as RenderableNode;
    const child = root.children?.[0];

    expect(root.x).toBe(100);
    expect(root.y).toBe(200);
    expect(child?.x).toBe(40);
    expect(child?.y).toBe(60);
    expect(child?.width).toBe(120);
    expect(child?.height).toBe(32);
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

  it("preserves normalized text color channels from converted CSS", async () => {
    const document = createDocument({
      root: createTextNode({
        style: {
          text: {
            fontFamily: "Inter",
            fontSize: 16,
            fontWeight: 400,
            color: {
              r: 203 / 255,
              g: 213 / 255,
              b: 225 / 255
            }
          }
        }
      })
    });
    const adapter = new FakeAdapter();

    const result = await renderWithAdapter(document, adapter);
    const root = result.root as unknown as RenderableNode;

    expect(root.fills).toEqual([
      {
        type: "SOLID",
        color: {
          r: 203 / 255,
          g: 213 / 255,
          b: 225 / 255
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
