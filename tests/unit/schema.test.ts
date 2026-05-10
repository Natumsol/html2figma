import { describe, expect, it } from "vitest";
import type { Html2FigmaDocument } from "../../src";

describe("Html2FigmaDocument schema", () => {
  it("serializes a frame root with a text child through JSON", () => {
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
        style: {
          fills: [
            {
              type: "solid",
              color: {
                r: 255,
                g: 255,
                b: 255
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
                lineHeight: 24,
                textAlign: "left",
                color: {
                  r: 20,
                  g: 24,
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

    const roundTripped = JSON.parse(JSON.stringify(document)) as Html2FigmaDocument;

    expect(roundTripped).toEqual(document);
    expect(roundTripped.root.type).toBe("frame");
    expect(roundTripped.root.children[0]?.type).toBe("text");
  });
});
