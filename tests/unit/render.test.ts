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
  rejectImages = false;
  autoAttachCreated = false;
  removedTypes: string[] = [];
  imageSources: string[] = [];
  private parents = new WeakMap<RenderableNode, RenderableNode>();

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
    const previous = this.parents.get(child);
    if (previous?.children) previous.children.splice(previous.children.indexOf(child), 1);
    parent.children ??= [];
    parent.children.push(child);
    this.parents.set(child, parent);
    if (parent.layoutMode && child.layoutPositioning !== "ABSOLUTE") {
      // Figma initially places an appended child in the Auto Layout flow.
      child.x = 16;
      child.y = 16;
    }
  }

  removeNode(node: RenderableNode): void {
    this.removedTypes.push(node.type ?? "unknown");
    const parent = this.parents.get(node);
    if (parent?.children) parent.children.splice(parent.children.indexOf(node), 1);
    this.parents.delete(node);
  }

  async loadFontAsync(fontName: FontName): Promise<void> {
    if (fontName.family === this.rejectFontFamily) {
      throw new Error("Font unavailable");
    }

    return;
  }

  async createImageAsync(source: string): Promise<string> {
    if (this.rejectImages) {
      throw new Error("Image type is unsupported");
    }

    this.imageSources.push(source);
    return `image-hash:${source}`;
  }

  private createNode(type: string): RenderableNode {
    this.createdTypes.push(type);
    const node: RenderableNode = {
      type,
      children: []
    };
    let positioning = "AUTO";
    Object.defineProperty(node, "layoutPositioning", {
      get: () => positioning,
      set: (value: string) => {
        if (value === "ABSOLUTE" && !this.parents.get(node)?.layoutMode) {
          throw new Error("Absolute positioning requires an Auto Layout parent");
        }
        positioning = value;
      }
    });
    if (this.autoAttachCreated) {
      this.currentPage.children!.push(node);
      this.parents.set(node, this.currentPage);
    }
    return node;
  }
}

describe("renderWithAdapter", () => {
  it("removes created scene nodes when rendering fails after node creation", async () => {
    const adapter = new FakeAdapter();
    adapter.autoAttachCreated = true;
    adapter.rejectFontFamily = "Inter";
    const document = createDocument({ root: {
      id: "frame-1", type: "frame", name: "Card",
      bounds: { x: 0, y: 0, width: 160, height: 80 }, style: {},
      source: { tagName: "div", path: "html > body > div" },
      warnings: [], children: [createTextNode()]
    } });

    await expect(renderWithAdapter(document, adapter)).rejects.toThrow("Font unavailable");
    expect(adapter.currentPage.children).toEqual([]);
    expect(adapter.removedTypes).toEqual(["TEXT", "FRAME"]);
  });

  it("reports each conversion warning once after JSON transport and preserves new render warnings", async () => {
    const warning = { code: "unsupported-transform", message: "Unsupported transform", severity: "warning" as const, nodeId: "text-1" };
    const document = createDocument({
      root: createTextNode({ warnings: [warning] }),
      warnings: [warning, { ...warning, nodeId: "other" }]
    });
    const adapter = new FakeAdapter();
    // Use a missing requested font while keeping the fallback available.
    document.root.style.text!.fontFamily = "Missing";
    adapter.rejectFontFamily = "Missing";
    const result = await renderWithAdapter(JSON.parse(JSON.stringify(document)), adapter);
    expect(result.warnings.filter(item => item.code === "unsupported-transform")).toEqual(document.warnings);
    expect(result.warnings.filter(item => item.code === "font-load-failed")).toHaveLength(1);
  });

  it("resizes Figma-like nodes without assigning read-only width and height", () => {
    let resizedTo: { width: number; height: number } | undefined;
    const node: RenderableNode = {
      type: "FRAME",
      children: [],
      get width() {
        return 0;
      },
      get height() {
        return 0;
      },
      resize(width: number, height: number) {
        resizedTo = {
          width,
          height
        };
      }
    };

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
    expect(resizedTo).toEqual({
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

  it("renders border helper children of flex frames as absolute positioned rectangles", async () => {
    const document = createDocument({
      root: {
        id: "root",
        type: "frame",
        name: "Flex Row",
        bounds: {
          x: 100,
          y: 200,
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
          {
            id: "border-top",
            type: "rectangle",
            name: "#border-top",
            bounds: {
              x: 100,
              y: 200,
              width: 320,
              height: 2
            },
            style: {},
            source: {
              tagName: "#border",
              path: "section > div > #border-top"
            },
            warnings: [],
            children: []
          },
          {
            id: "border-right",
            type: "rectangle",
            name: "#border-right",
            bounds: {
              x: 416,
              y: 200,
              width: 4,
              height: 48
            },
            style: {},
            source: {
              tagName: "#border",
              path: "section > div > #border-right"
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
    const [topBorder, rightBorder] = root.children ?? [];

    expect(topBorder).toMatchObject({
      layoutPositioning: "ABSOLUTE",
      layoutSizingHorizontal: "FIXED",
      layoutSizingVertical: "FIXED",
      x: 0,
      y: 0,
      width: 320,
      height: 2
    });
    expect(rightBorder).toMatchObject({
      layoutPositioning: "ABSOLUTE",
      layoutSizingHorizontal: "FIXED",
      layoutSizingVertical: "FIXED",
      x: 316,
      y: 0,
      width: 4,
      height: 48
    });
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

  it("maps AST text case to Figma text case", async () => {
    const document = createDocument({
      root: createTextNode({
        style: {
          text: {
            fontFamily: "Inter",
            fontSize: 16,
            fontWeight: 400,
            textCase: "upper"
          }
        }
      })
    });
    const adapter = new FakeAdapter();

    const result = await renderWithAdapter(document, adapter);
    const textNode = result.root as unknown as RenderableNode;

    expect(textNode.textCase).toBe("UPPER");
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

  it("warns and keeps rendering when an image resource cannot be created", async () => {
    const document = createDocument({
      root: {
        id: "image-1",
        type: "image",
        name: "Unsupported Image",
        resourceId: "resource-1",
        bounds: {
          x: 0,
          y: 0,
          width: 240,
          height: 160
        },
        style: {},
        source: {
          tagName: "img",
          path: "html > body > img"
        },
        warnings: [],
        children: []
      },
      resources: [
        {
          id: "resource-1",
          type: "image",
          source: "https://example.com/image.webp",
          mimeType: "image/webp"
        }
      ]
    });
    const adapter = new FakeAdapter();
    adapter.rejectImages = true;

    const result = await renderWithAdapter(document, adapter);

    expect(result.root.type).toBe("RECTANGLE");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "image-load-failed",
        source: "https://example.com/image.webp"
      })
    );
  });

  it("keeps an image node src fill when CSS background image fills are present", async () => {
    const document = createDocument({
      root: {
        id: "image-1",
        type: "image",
        name: "Photo",
        resourceId: "resource-1",
        bounds: {
          x: 0,
          y: 0,
          width: 240,
          height: 160
        },
        style: {
          fills: [
            {
              type: "image",
              resourceId: "resource-2",
              opacity: 1,
              scaleMode: "fill"
            }
          ]
        },
        source: {
          tagName: "img",
          path: "html > body > img"
        },
        warnings: [],
        children: []
      },
      resources: [
        {
          id: "resource-1",
          type: "image",
          source: "https://example.com/photo.png",
          mimeType: "image/png"
        },
        {
          id: "resource-2",
          type: "image",
          source: "https://example.com/background.png",
          mimeType: "image/png"
        }
      ]
    });
    const adapter = new FakeAdapter();

    const result = await renderWithAdapter(document, adapter);
    const root = result.root as unknown as RenderableNode;

    expect(adapter.imageSources).toEqual([
      "https://example.com/background.png",
      "https://example.com/photo.png"
    ]);
    expect(root.fills).toContainEqual(
      expect.objectContaining({
        type: "IMAGE",
        imageHash: "image-hash:https://example.com/photo.png"
      })
    );
  });

  it("removes failed image fills instead of passing resource IDs as image hashes", async () => {
    const document = createDocument({
      root: {
        id: "frame-1",
        type: "frame",
        name: "Card",
        bounds: {
          x: 0,
          y: 0,
          width: 240,
          height: 160
        },
        style: {
          fills: [
            {
              type: "image",
              resourceId: "resource-1",
              opacity: 1,
              scaleMode: "fill"
            }
          ]
        },
        source: {
          tagName: "div",
          path: "html > body > div"
        },
        warnings: [],
        children: []
      },
      resources: [
        {
          id: "resource-1",
          type: "image",
          source: "https://example.com/image.webp",
          mimeType: "image/webp"
        }
      ]
    });
    const adapter = new FakeAdapter();
    adapter.rejectImages = true;

    const result = await renderWithAdapter(document, adapter);
    const root = result.root as unknown as RenderableNode;

    expect(root.fills).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "image-load-failed"
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
