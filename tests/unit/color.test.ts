import { describe, expect, it } from "vitest";
import { parseCssColor } from "../../src/utils/color";

describe("parseCssColor", () => {
  it("parses numeric rgb colors into normalized RGB", () => {
    expect(parseCssColor("rgb(255, 128, 0)")).toEqual({
      color: {
        r: 1,
        g: 128 / 255,
        b: 0
      },
      opacity: 1
    });
  });

  it("parses numeric rgba colors into normalized RGB with opacity", () => {
    expect(parseCssColor("rgba(10, 20, 30, 0.5)")).toEqual({
      color: {
        r: 10 / 255,
        g: 20 / 255,
        b: 30 / 255
      },
      opacity: 0.5
    });
  });

  it("treats fully transparent colors as absent", () => {
    expect(parseCssColor("rgba(0, 0, 0, 0)")).toBeUndefined();
    expect(parseCssColor("transparent")).toBeUndefined();
  });
});
