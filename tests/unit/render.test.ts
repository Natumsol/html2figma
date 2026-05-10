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

  async loadFontAsync(): Promise<void> {
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
    expect(result.warnings).toEqual([]);
  });
});
